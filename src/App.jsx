
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import "./App.css";

const STORAGE_KEY = "ocs_data";
const SESSION_KEY = "ocs_session";

const initialData = {
  users: [
    {
      id: 1,
      username: "admin",
      password: "admin12345",
      name: "Abdulhodiy",
      role: "admin",
      status: "approved",
    },
  ],
  students: [],
  rooms: [],
  attendance: [],
  clubs: [],
  sports: [],
  nominations: [],
  messages: [],
};

const menuItems = [
  { id: "dashboard", icon: "⌂", label: "Bosh sahifa" },
  { id: "students", icon: "♙", label: "O‘quvchilar" },
  { id: "rooms", icon: "▦", label: "Xonalar" },
  { id: "attendance", icon: "✓", label: "Davomat" },
  { id: "parents", icon: "♧", label: "Ota-onalar" },
  { id: "staff", icon: "♟", label: "Xodimlar" },
  { id: "clubs", icon: "✦", label: "To‘garaklar" },
  { id: "sports", icon: "⚽", label: "Sport natijalari" },
  { id: "nominations", icon: "🏆", label: "Nominatsiyalar" },
  { id: "messages", icon: "✉", label: "Xabarlar" },
  { id: "reports", icon: "▤", label: "Hisobotlar" },
  { id: "settings", icon: "⚙", label: "Sozlamalar" },
];

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return initialData;

    const parsed = JSON.parse(saved);

    return {
      ...initialData,
      ...parsed,
      users: [
        ...initialData.users,
        ...(parsed.users || []).filter(
          (user) => user.username !== "admin"
        ),
      ],
    };
  } catch {
    return initialData;
  }
}

function Empty({ children = "Hozircha ma’lumot mavjud emas." }) {
  return (
    <p style={{ textAlign: "center", padding: 25, color: "#9299ad" }}>
      {children}
    </p>
  );
}

function Table({ headers, children }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch {
      return null;
    }
  });

  const [activePage, setActivePage] = useState("dashboard");
  const [authMode, setAuthMode] = useState("login");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "parent",
  });

  const [studentForm, setStudentForm] = useState({
    name: "",
    parent: "",
    birth: "",
    gender: "O‘g‘il",
    grade: "",
    room: "",
  });

  const [roomForm, setRoomForm] = useState({
    name: "",
    capacity: "",
  });

  const [clubForm, setClubForm] = useState({
    name: "",
    leader: "",
  });

  const [sportForm, setSportForm] = useState({
    student: "",
    sport: "",
    result: "",
  });

  const [nominationForm, setNominationForm] = useState({
    student: "",
    title: "",
    description: "",
  });

  const [messageForm, setMessageForm] = useState({
    title: "",
    message: "",
  });

  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [user]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const update = (key, value) => {
    setData((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const isAdmin = user?.role === "admin";

  const pageTitle =
    menuItems.find((item) => item.id === activePage)?.label || "Bosh sahifa";

  const approvedUsers = data.users.filter(
    (item) => item.status === "approved"
  );

  const parents = approvedUsers.filter((item) => item.role === "parent");
  const workers = approvedUsers.filter((item) => item.role === "worker");

  const filteredStudents = useMemo(() => {
    const value = search.toLowerCase().trim();

    return data.students.filter((student) =>
      [
        student.name,
        student.parent,
        student.grade,
        student.room,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [data.students, search]);

  async function login(event) {
  event.preventDefault();

  try {
    const username = loginForm.username.trim().toLowerCase();
    const email = `${username}@oksana-school.test`;

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      loginForm.password
    );

    const userDoc = await getDoc(doc(db, "users", result.user.uid));

    if (!userDoc.exists()) {
      await signOut(auth);
      notify("Foydalanuvchi profili topilmadi!");
      return;
    }

    const found = {
      id: result.user.uid,
      ...userDoc.data(),
    };

    if (found.status !== "approved") {
      await signOut(auth);
      notify("Hisobingiz hali administrator tomonidan tasdiqlanmagan.");
      return;
    }

    setUser(found);
    setActivePage("dashboard");
    notify("Tizimga muvaffaqiyatli kirdingiz!");
  } catch (error) {
    console.error(error);
    notify("Login yoki parol noto‘g‘ri!");
  }
}

 async function register(event) {
  event.preventDefault();

  const name = registerForm.name.trim();
  const username = registerForm.username.trim().toLowerCase();
  const password = registerForm.password;

  if (!name || !username) {
    notify("Barcha kerakli maydonlarni to‘ldiring.");
    return;
  }

  if (password.length < 6) {
    notify("Parol kamida 6 ta belgidan iborat bo‘lsin.");
    return;
  }

  if (!["parent", "worker"].includes(registerForm.role)) {
    notify("Noto‘g‘ri foydalanuvchi roli.");
    return;
  }

  try {
    const email = `${username}@oksana-school.test`;

    const check = await getDoc(doc(db, "usernames", username));

    if (check.exists()) {
      notify("Bu login band!");
      return;
    }

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await setDoc(doc(db, "users", result.user.uid), {
      name,
      username,
      role: registerForm.role,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "usernames", username), {
      uid: result.user.uid,
    });

    await signOut(auth);

    setRegisterForm({
      name: "",
      username: "",
      password: "",
      role: "parent",
    });

    setAuthMode("login");
    notify("Ro‘yxatdan o‘tdingiz. Admin tasdig‘ini kuting.");
  } catch (error) {
    console.error(error);
    notify("Xatolik: " + error.message);
  }
}



  function logout() {
    setUser(null);
    setActivePage("dashboard");
    setLoginForm({ username: "", password: "" });
  }

  function addStudent(event) {
    event.preventDefault();

    if (!studentForm.name.trim()) {
      notify("O‘quvchi F.I.O. sini kiriting.");
      return;
    }

    const student = {
      id: Date.now(),
      ...studentForm,
      name: studentForm.name.trim(),
    };

    update("students", [...data.students, student]);

    setStudentForm({
      name: "",
      parent: "",
      birth: "",
      gender: "O‘g‘il",
      grade: "",
      room: "",
    });

    notify("O‘quvchi qo‘shildi!");
  }

  function deleteStudent(id) {
    if (!window.confirm("O‘quvchini o‘chirmoqchimisiz?")) return;

    update(
      "students",
      data.students.filter((student) => student.id !== id)
    );

    update(
      "attendance",
      data.attendance.filter((item) => item.studentId !== id)
    );

    notify("O‘quvchi o‘chirildi.");
  }

  function importExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rows.length) {
          notify("Excel faylida ma’lumot topilmadi.");
          return;
        }

        const imported = rows
          .map((row) => {
            const getValue = (...keys) => {
              const key = Object.keys(row).find((item) =>
                keys.includes(
                  item.toLowerCase().replace(/\s/g, "")
                )
              );

              return key ? String(row[key]).trim() : "";
            };

            return {
              id: Date.now() + Math.random(),
              name: getValue("f.i.o", "fio", "ism", "ismfamiliya"),
              parent: getValue("ota-ona", "otaona", "otaonasi"),
              birth: getValue("tugilgansana", "tug‘ilgansana", "birth"),
              gender: getValue("jins") || "Ko‘rsatilmagan",
              grade: getValue("sinf", "grade"),
              room: getValue("xona", "room"),
            };
          })
          .filter((student) => student.name);

        if (!imported.length) {
          notify("F.I.O. ustuni topilmadi yoki bo‘sh.");
          return;
        }

        update("students", [...data.students, ...imported]);
        notify(`${imported.length} ta o‘quvchi Excel orqali qo‘shildi!`);
      } catch {
        notify("Excel faylini o‘qishda xatolik yuz berdi.");
      }

      event.target.value = "";
    };

    reader.readAsArrayBuffer(file);
  }

  function addRoom(event) {
    event.preventDefault();

    if (!roomForm.name.trim() || Number(roomForm.capacity) < 1) {
      notify("Xona nomi va sig‘imini to‘g‘ri kiriting.");
      return;
    }

    if (data.rooms.some((room) => room.name === roomForm.name.trim())) {
      notify("Bu xona allaqachon mavjud.");
      return;
    }

    update("rooms", [
      ...data.rooms,
      {
        id: Date.now(),
        name: roomForm.name.trim(),
        capacity: Number(roomForm.capacity),
      },
    ]);

    setRoomForm({ name: "", capacity: "" });
    notify("Xona yaratildi!");
  }

  function assignRoom(studentId, roomName) {
    const room = data.rooms.find((item) => item.name === roomName);

    if (room) {
      const count = data.students.filter(
        (student) =>
          student.room === roomName && student.id !== studentId
      ).length;

      if (count >= room.capacity) {
        notify("Bu xonada bo‘sh joy qolmagan!");
        return;
      }
    }

    update(
      "students",
      data.students.map((student) =>
        student.id === studentId
          ? { ...student, room: roomName }
          : student
      )
    );

    notify("O‘quvchining xonasi yangilandi.");
  }

  function saveAttendance(studentId, status) {
    const exists = data.attendance.find(
      (item) =>
        item.studentId === studentId &&
        item.date === attendanceDate
    );

    if (exists) {
      update(
        "attendance",
        data.attendance.map((item) =>
          item.studentId === studentId && item.date === attendanceDate
            ? { ...item, status }
            : item
        )
      );
    } else {
      update("attendance", [
        ...data.attendance,
        {
          id: Date.now() + Math.random(),
          studentId,
          date: attendanceDate,
          status,
        },
      ]);
    }
  }

  function addClub(event) {
    event.preventDefault();

    if (!clubForm.name.trim()) {
      notify("To‘garak nomini kiriting.");
      return;
    }

    update("clubs", [
      ...data.clubs,
      { id: Date.now(), ...clubForm },
    ]);

    setClubForm({ name: "", leader: "" });
    notify("To‘garak qo‘shildi!");
  }

  function addSport(event) {
    event.preventDefault();

    if (!sportForm.student || !sportForm.sport.trim()) {
      notify("O‘quvchi va sport turini kiriting.");
      return;
    }

    update("sports", [
      ...data.sports,
      { id: Date.now(), ...sportForm },
    ]);

    setSportForm({ student: "", sport: "", result: "" });
    notify("Sport natijasi saqlandi!");
  }

  function addNomination(event) {
    event.preventDefault();

    if (!nominationForm.student || !nominationForm.title.trim()) {
      notify("O‘quvchi va nominatsiyani kiriting.");
      return;
    }

    update("nominations", [
      ...data.nominations,
      { id: Date.now(), ...nominationForm },
    ]);

    setNominationForm({
      student: "",
      title: "",
      description: "",
    });

    notify("Nominatsiya qo‘shildi!");
  }

  function addMessage(event) {
    event.preventDefault();

    if (!messageForm.title.trim() || !messageForm.message.trim()) {
      notify("Xabar ma’lumotlarini to‘ldiring.");
      return;
    }

    update("messages", [
      ...data.messages,
      {
        id: Date.now(),
        ...messageForm,
        date: new Date().toLocaleString("uz-UZ"),
      },
    ]);

    setMessageForm({ title: "", message: "" });
    notify("Xabar saqlandi!");
  }

  function approveUser(id) {
    update(
      "users",
      data.users.map((item) =>
        item.id === id ? { ...item, status: "approved" } : item
      )
    );

    notify("Foydalanuvchi tasdiqlandi!");
  }

  function rejectUser(id) {
    update(
      "users",
      data.users.filter((item) => item.id !== id)
    );

    notify("So‘rov rad etildi.");
  }

  function deleteRecord(key, id) {
    if (!window.confirm("O‘chirishni tasdiqlaysizmi?")) return;

    update(
      key,
      data[key].filter((item) => item.id !== id)
    );

    notify("Ma’lumot o‘chirildi.");
  }

  function exportExcel() {
    const rows = data.students.map((student) => ({
      "F.I.O": student.name,
      "Ota-ona": student.parent,
      "Tugilgan sana": student.birth,
      "Jins": student.gender,
      "Sinf": student.grade,
      "Xona": student.room,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Oquvchilar");
    XLSX.writeFile(workbook, "Oksana_Chusovitina_Oquvchilar.xlsx");

    notify("Excel fayli tayyor!");
  }

  function downloadTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["F.I.O", "Ota-ona", "Tugilgan sana", "Jins", "Sinf", "Xona"],
      ["Ali Valiyev", "Vali Valiyev", "2012-05-10", "O‘g‘il", "7-A", "101"],
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Oquvchilar");
    XLSX.writeFile(workbook, "Oquvchilar_namuna.xlsx");
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">🎓</div>

          <h1>Oksana Chusovitina maktabi</h1>
          <p>Yotoqxona boshqaruv tizimi</p>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "selected" : ""}
              onClick={() => setAuthMode("login")}
            >
              Kirish
            </button>

            <button
              className={authMode === "register" ? "selected" : ""}
              onClick={() => setAuthMode("register")}
            >
              Ro‘yxatdan o‘tish
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={login}>
              <Field label="Login">
                <input
                  required
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({
                      ...loginForm,
                      username: e.target.value,
                    })
                  }
                  placeholder="Loginingizni kiriting"
                />
              </Field>

              <Field label="Parol">
                <input
                  required
                  type="password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({
                      ...loginForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="Parolingizni kiriting"
                />
              </Field>

              <button className="primary-button" type="submit">
                Tizimga kirish →
              </button>
            </form>
          ) : (
            <form onSubmit={register}>
              <Field label="F.I.O.">
                <input
                  required
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      name: e.target.value,
                    })
                  }
                  placeholder="Ism va familiyangiz"
                />
              </Field>

              <Field label="Login">
                <input
                  required
                  value={registerForm.username}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      username: e.target.value,
                    })
                  }
                  placeholder="Yangi login"
                />
              </Field>

              <Field label="Parol">
                <input
                  required
                  type="password"
                  minLength={6}
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="Kamida 6 ta belgi"
                />
              </Field>

              <Field label="Hisob turi">
                <select
                  value={registerForm.role}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      role: e.target.value,
                    })
                  }
                >
                  <option value="parent">Ota-ona</option>
                  <option value="worker">Xodim</option>
                </select>
              </Field>

              <button className="primary-button" type="submit">
                Ro‘yxatdan o‘tish
              </button>
            </form>
          )}

          <span className="auth-note">
            Faqat administrator tasdiqlagan hisoblar tizimga kira oladi.
            <br />
            Demo administrator: admin / admin12345
          </span>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  function renderDashboard() {
    return (
      <>
        <div className="welcome">
          <div>
            <span>YOTOQXONA BOSHQARUV TIZIMI</span>
            <h1>Xush kelibsiz, {user.name}!</h1>
            <p>Oksana Chusovitina maktabi boshqaruv paneli.</p>
          </div>
          <div className="welcome-icon">🎓</div>
        </div>

        <div className="stats">
          <div className="stat">
            <span>👨‍🎓</span>
            <p>Jami o‘quvchilar</p>
            <h2>{data.students.length}</h2>
          </div>

          <div className="stat">
            <span>🏠</span>
            <p>Jami xonalar</p>
            <h2>{data.rooms.length}</h2>
          </div>

          <div className="stat">
            <span>👨‍👩‍👧</span>
            <p>Ota-onalar</p>
            <h2>{parents.length}</h2>
          </div>

          <div className="stat">
            <span>👥</span>
            <p>Xodimlar</p>
            <h2>{workers.length}</h2>
          </div>
        </div>

        <div className="panel">
          <h2>Tezkor amallar</h2>
          <div className="quick-actions">
            {[
              ["O‘quvchi qo‘shish", "students"],
              ["Xona yaratish", "rooms"],
              ["Davomat belgilash", "attendance"],
              ["Hisobotlar", "reports"],
            ].map(([label, page]) => (
              <button key={page} onClick={() => setActivePage(page)}>
                + {label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Oxirgi qo‘shilgan o‘quvchilar</h2>
          {data.students.length ? (
            <Table headers={["F.I.O.", "Sinf", "Xona", "Ota-ona"]}>
              {data.students.slice(-5).reverse().map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.grade || "—"}</td>
                  <td>{student.room || "—"}</td>
                  <td>{student.parent || "—"}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Hali o‘quvchilar qo‘shilmagan.</Empty>
          )}
        </div>
      </>
    );
  }

  function renderStudents() {
    return (
      <>
        <div className="panel">
          <h2>Yangi o‘quvchi qo‘shish</h2>

          <form className="record-form" onSubmit={addStudent}>
            <div className="form-grid">
              <Field label="O‘quvchi F.I.O.">
                <input
                  required
                  value={studentForm.name}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, name: e.target.value })
                  }
                  placeholder="Ism Familiya"
                />
              </Field>

              <Field label="Ota-onasi (ixtiyoriy)">
                <input
                  value={studentForm.parent}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, parent: e.target.value })
                  }
                  placeholder="Ota-ona F.I.O."
                />
              </Field>

              <Field label="Tug‘ilgan sana">
                <input
                  type="date"
                  value={studentForm.birth}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, birth: e.target.value })
                  }
                />
              </Field>

              <Field label="Jinsi">
                <select
                  value={studentForm.gender}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, gender: e.target.value })
                  }
                >
                  <option>O‘g‘il</option>
                  <option>Qiz</option>
                </select>
              </Field>

              <Field label="Sinfi">
                <input
                  value={studentForm.grade}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, grade: e.target.value })
                  }
                  placeholder="Masalan: 7-A"
                />
              </Field>

              <Field label="Xonasi">
                <select
                  value={studentForm.room}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, room: e.target.value })
                  }
                >
                  <option value="">Xona tanlanmagan</option>
                  {data.rooms.map((room) => (
                    <option key={room.id} value={room.name}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button className="primary-button" type="submit">
              + O‘quvchini saqlash
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="toolbar">
            <h3>O‘quvchilar ro‘yxati ({data.students.length})</h3>

            <input
              placeholder="O‘quvchini qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <label className="upload-button">
              Excel yuklash
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={importExcel}
                hidden
              />
            </label>

            <button className="secondary-button" onClick={downloadTemplate}>
              Excel namuna
            </button>

            <button className="secondary-button" onClick={exportExcel}>
              Excel eksport
            </button>
          </div>

          {filteredStudents.length ? (
            <Table
              headers={[
                "№",
                "F.I.O.",
                "Ota-ona",
                "Tug‘ilgan sana",
                "Jins",
                "Sinf",
                "Xona",
                "Amal",
              ]}
            >
              {filteredStudents.map((student, index) => (
                <tr key={student.id}>
                  <td>{index + 1}</td>
                  <td>{student.name}</td>
                  <td>{student.parent || "—"}</td>
                  <td>{student.birth || "—"}</td>
                  <td>{student.gender}</td>
                  <td>{student.grade || "—"}</td>
                  <td>{student.room || "—"}</td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() => deleteStudent(student.id)}
                    >
                      O‘chirish
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>O‘quvchilar topilmadi.</Empty>
          )}
        </div>
      </>
    );
  }

  function renderRooms() {
    return (
      <>
        <div className="panel">
          <h2>Yangi xona yaratish</h2>

          <form className="record-form" onSubmit={addRoom}>
            <div className="form-grid">
              <Field label="Xona nomi yoki raqami">
                <input
                  required
                  value={roomForm.name}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, name: e.target.value })
                  }
                  placeholder="Masalan: 101"
                />
              </Field>

              <Field label="Xona sig‘imi">
                <input
                  required
                  type="number"
                  min="1"
                  value={roomForm.capacity}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, capacity: e.target.value })
                  }
                  placeholder="Masalan: 4"
                />
              </Field>
            </div>

            <button className="primary-button" type="submit">
              + Xona yaratish
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Xonalar ro‘yxati</h2>

          {data.rooms.length ? (
            <Table headers={["Xona", "Sig‘imi", "O‘quvchilar", "Bo‘sh joy"]}>
              {data.rooms.map((room) => {
                const count = data.students.filter(
                  (student) => student.room === room.name
                ).length;

                return (
                  <tr key={room.id}>
                    <td>{room.name}</td>
                    <td>{room.capacity}</td>
                    <td>{count}</td>
                    <td>{Math.max(0, room.capacity - count)}</td>
                    <td>
                      <button
                        className="delete-button"
                        onClick={() => deleteRecord("rooms", room.id)}
                      >
                        O‘chirish
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty>Hali xonalar yaratilmagan.</Empty>
          )}
        </div>

        <div className="panel">
          <h2>O‘quvchini xonaga joylashtirish</h2>

          {data.students.length && data.rooms.length ? (
            data.students.map((student) => (
              <div className="attendance-row" key={student.id}>
                <strong>{student.name}</strong>

                <select
                  value={student.room || ""}
                  onChange={(e) => assignRoom(student.id, e.target.value)}
                >
                  <option value="">Xona tanlang</option>
                  {data.rooms.map((room) => (
                    <option key={room.id} value={room.name}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
            ))
          ) : (
            <Empty>Avval o‘quvchi va xona qo‘shing.</Empty>
          )}
        </div>
      </>
    );
  }

  function renderAttendance() {
    return (
      <div className="panel">
        <div className="toolbar">
          <h3>Davomat</h3>
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
          />
        </div>

        {data.students.length ? (
          data.students.map((student) => {
            const record = data.attendance.find(
              (item) =>
                item.studentId === student.id &&
                item.date === attendanceDate
            );

            return (
              <div className="attendance-row" key={student.id}>
                <strong>
                  {student.name} — {student.grade || "Sinf yo‘q"}
                </strong>

                <select
                  value={record?.status || ""}
                  onChange={(e) =>
                    saveAttendance(student.id, e.target.value)
                  }
                >
                  <option value="">Belgilanmagan</option>
                  <option value="Keldi">Keldi</option>
                  <option value="Kelmadi">Kelmadi</option>
                  <option value="Sababli">Sababli</option>
                </select>
              </div>
            );
          })
        ) : (
          <Empty>Davomat uchun avval o‘quvchi qo‘shing.</Empty>
        )}
      </div>
    );
  }

  function renderParents() {
    return (
      <div className="panel">
        <h2>Ota-onalar ro‘yxati</h2>

        {parents.length ? (
          <Table headers={["F.I.O.", "Login", "Holati"]}>
            {parents.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.username}</td>
                <td>Tasdiqlangan</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Ota-onalar ro‘yxati bo‘sh.</Empty>
        )}
      </div>
    );
  }

  function renderStaff() {
    return (
      <div className="panel">
        <h2>Xodimlar ro‘yxati</h2>

        {workers.length ? (
          <Table headers={["F.I.O.", "Login", "Holati"]}>
            {workers.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.username}</td>
                <td>Tasdiqlangan</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Xodimlar ro‘yxati bo‘sh.</Empty>
        )}
      </div>
    );
  }

  function renderClubs() {
    return (
      <>
        <div className="panel">
          <h2>To‘garak qo‘shish</h2>

          <form className="record-form" onSubmit={addClub}>
            <div className="form-grid">
              <Field label="To‘garak nomi">
                <input
                  required
                  value={clubForm.name}
                  onChange={(e) =>
                    setClubForm({ ...clubForm, name: e.target.value })
                  }
                  placeholder="Masalan: Shaxmat"
                />
              </Field>

              <Field label="Mas’ul shaxs">
                <input
                  value={clubForm.leader}
                  onChange={(e) =>
                    setClubForm({ ...clubForm, leader: e.target.value })
                  }
                  placeholder="Mas’ul shaxs"
                />
              </Field>
            </div>

            <button className="primary-button">To‘garakni saqlash</button>
          </form>
        </div>

        <div className="panel">
          <h2>To‘garaklar</h2>

          {data.clubs.length ? (
            <Table headers={["To‘garak", "Mas’ul", "Amal"]}>
              {data.clubs.map((club) => (
                <tr key={club.id}>
                  <td>{club.name}</td>
                  <td>{club.leader || "—"}</td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() => deleteRecord("clubs", club.id)}
                    >
                      O‘chirish
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Hali to‘garaklar yo‘q.</Empty>
          )}
        </div>
      </>
    );
  }

  function renderSports() {
    return (
      <>
        <div className="panel">
          <h2>Sport natijasini qo‘shish</h2>

          <form className="record-form" onSubmit={addSport}>
            <Field label="O‘quvchi">
              <select
                required
                value={sportForm.student}
                onChange={(e) =>
                  setSportForm({ ...sportForm, student: e.target.value })
                }
              >
                <option value="">O‘quvchini tanlang</option>
                {data.students.map((student) => (
                  <option key={student.id} value={student.name}>
                    {student.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sport turi">
              <input
                required
                value={sportForm.sport}
                onChange={(e) =>
                  setSportForm({ ...sportForm, sport: e.target.value })
                }
                placeholder="Masalan: Gimnastika"
              />
            </Field>

            <Field label="Natija">
              <input
                value={sportForm.result}
                onChange={(e) =>
                  setSportForm({ ...sportForm, result: e.target.value })
                }
                placeholder="Masalan: 1-o‘rin"
              />
            </Field>

            <button className="primary-button">Natijani saqlash</button>
          </form>
        </div>

        <div className="panel">
          <h2>Sport natijalari</h2>

          {data.sports.length ? (
            <Table headers={["O‘quvchi", "Sport", "Natija", "Amal"]}>
              {data.sports.map((item) => (
                <tr key={item.id}>
                  <td>{item.student}</td>
                  <td>{item.sport}</td>
                  <td>{item.result || "—"}</td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() => deleteRecord("sports", item.id)}
                    >
                      O‘chirish
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Sport natijalari mavjud emas.</Empty>
          )}
        </div>
      </>
    );
  }

  function renderNominations() {
    return (
      <>
        <div className="panel">
          <h2>Nominatsiya berish</h2>

          <form className="record-form" onSubmit={addNomination}>
            <Field label="O‘quvchi">
              <select
                required
                value={nominationForm.student}
                onChange={(e) =>
                  setNominationForm({
                    ...nominationForm,
                    student: e.target.value,
                  })
                }
              >
                <option value="">O‘quvchini tanlang</option>
                {data.students.map((student) => (
                  <option key={student.id} value={student.name}>
                    {student.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nominatsiya nomi">
              <input
                required
                value={nominationForm.title}
                onChange={(e) =>
                  setNominationForm({
                    ...nominationForm,
                    title: e.target.value,
                  })
                }
                placeholder="Masalan: Eng faol o‘quvchi"
              />
            </Field>

            <Field label="Izoh">
              <input
                value={nominationForm.description}
                onChange={(e) =>
                  setNominationForm({
                    ...nominationForm,
                    description: e.target.value,
                  })
                }
                placeholder="Qo‘shimcha ma’lumot"
              />
            </Field>

            <button className="primary-button">Nominatsiya berish</button>
          </form>
        </div>

        <div className="panel">
          <h2>Nominatsiyalar</h2>

          {data.nominations.length ? (
            <Table headers={["O‘quvchi", "Nominatsiya", "Izoh", "Amal"]}>
              {data.nominations.map((item) => (
                <tr key={item.id}>
                  <td>{item.student}</td>
                  <td>{item.title}</td>
                  <td>{item.description || "—"}</td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() => deleteRecord("nominations", item.id)}
                    >
                      O‘chirish
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Nominatsiyalar hali yo‘q.</Empty>
          )}
        </div>
      </>
    );
  }

  function renderMessages() {
    return (
      <>
        <div className="panel">
          <h2>Yangi xabar</h2>

          <form className="record-form" onSubmit={addMessage}>
            <Field label="Xabar sarlavhasi">
              <input
                required
                value={messageForm.title}
                onChange={(e) =>
                  setMessageForm({ ...messageForm, title: e.target.value })
                }
                placeholder="Sarlavha"
              />
            </Field>

            <Field label="Xabar matni">
              <textarea
                required
                rows="4"
                value={messageForm.message}
                onChange={(e) =>
                  setMessageForm({ ...messageForm, message: e.target.value })
                }
                placeholder="Xabar matnini yozing"
              />
            </Field>

            <button className="primary-button">Xabarni saqlash</button>
          </form>
        </div>

        <div className="panel">
          <h2>Xabarlar tarixi</h2>

          {data.messages.length ? (
            data.messages.slice().reverse().map((item) => (
              <div className="panel" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                <p>{item.date}</p>
                <button
                  className="delete-button"
                  onClick={() => deleteRecord("messages", item.id)}
                >
                  O‘chirish
                </button>
              </div>
            ))
          ) : (
            <Empty>Hozircha xabarlar yo‘q.</Empty>
          )}
        </div>
      </>
    );
  }

  function renderReports() {
    const present = data.attendance.filter(
      (item) => item.status === "Keldi"
    ).length;

    const absent = data.attendance.filter(
      (item) => item.status === "Kelmadi"
    ).length;

    return (
      <div className="panel">
        <h2>Hisobotlar</h2>

        <p>Jami o‘quvchilar: {data.students.length}</p>
        <p>Jami xonalar: {data.rooms.length}</p>
        <p>Ota-onalar: {parents.length}</p>
        <p>Xodimlar: {workers.length}</p>
        <p>Belgilangan davomat yozuvlari: {data.attendance.length}</p>
        <p>Kelganlar yozuvlari: {present}</p>
        <p>Kelmaganlar yozuvlari: {absent}</p>
        <p>To‘garaklar: {data.clubs.length}</p>
        <p>Sport natijalari: {data.sports.length}</p>
        <p>Nominatsiyalar: {data.nominations.length}</p>

        <button className="primary-button" onClick={() => window.print()}>
          Hisobotni chop etish
        </button>

        <button className="secondary-button" onClick={exportExcel}>
          O‘quvchilarni Excelga yuklash
        </button>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="panel">
        <h2>Sozlamalar</h2>

        <p>
          Tizim nomi: Oksana Chusovitina maktabi
        </p>
        <p>
          Sizning hisobingiz: {user.username}
        </p>
        <p>
          Hisob turi: {user.role === "admin" ? "Administrator" : user.role}
        </p>

        {isAdmin && (
          <>
            <button
              className="secondary-button"
              onClick={() => {
                const blob = new Blob(
                  [JSON.stringify(data, null, 2)],
                  { type: "application/json" }
                );

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = url;
                link.download = "ocs-backup.json";
                link.click();

                URL.revokeObjectURL(url);
                notify("Zaxira nusxasi yuklandi.");
              }}
            >
              Ma’lumotlarni zaxiralash
            </button>

            <button
              className="delete-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Barcha demo ma’lumotlarni o‘chirmoqchimisiz? Bu amalni qaytarib bo‘lmaydi."
                  )
                ) {
                  const cleanData = {
                    ...initialData,
                    users: data.users.filter(
                      (item) => item.role === "admin"
                    ),
                  };

                  setData(cleanData);
                  notify("Demo ma’lumotlar tozalandi.");
                }
              }}
            >
              Demo ma’lumotlarni tozalash
            </button>
          </>
        )}
      </div>
    );
  }

  const pageContent = {
    dashboard: renderDashboard,
    students: renderStudents,
    rooms: renderRooms,
    attendance: renderAttendance,
    parents: renderParents,
    staff: renderStaff,
    clubs: renderClubs,
    sports: renderSports,
    nominations: renderNominations,
    messages: renderMessages,
    reports: renderReports,
    settings: renderSettings,
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🎓</div>
          <h2>Oksana Chusovitina maktabi</h2>
          <p>Yotoqxona boshqaruv tizimi</p>
        </div>

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`menu-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => {
                setActivePage(item.id);
                setSearch("");
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          OKSANA CHUSOVITINA SCHOOL
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>{pageTitle}</h2>
            <p>Oksana Chusovitina maktabi</p>
          </div>

          <div className="user-area">
            <span>
              {user.name} · {isAdmin ? "Admin" : user.role}
            </span>

            <button onClick={logout}>Chiqish</button>
          </div>
        </header>

        <section className="page-content">
          {pageContent[activePage]?.()}
        </section>

        <footer className="footer">
          © {new Date().getFullYear()} Oksana Chusovitina maktabi
        </footer>

        {isAdmin && (
          <div className="admin-approvals">
            <details>
              <summary>
                Foydalanuvchilar so‘rovlari (
                {data.users.filter((item) => item.status === "pending").length}
                )
              </summary>

              {data.users.filter((item) => item.status === "pending").length ? (
                data.users
                  .filter((item) => item.status === "pending")
                  .map((item) => (
                    <div className="approval-row" key={item.id}>
                      <span>
                        {item.name} — {item.role} ({item.username})
                      </span>

                      <button onClick={() => approveUser(item.id)}>
                        Tasdiqlash
                      </button>

                      <button
                        className="delete-button"
                        onClick={() => rejectUser(item.id)}
                      >
                        Rad etish
                      </button>
                    </div>
                  ))
              ) : (
                <Empty>Yangi so‘rovlar yo‘q.</Empty>
              )}
            </details>
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
