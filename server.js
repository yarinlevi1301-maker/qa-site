const express = require("express")
const fs = require("fs")
const session = require("express-session")
const multer = require("multer")

const app = express()
app.use(express.json())

app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: true
}))

app.use(express.static("public"))

/* MULTER (UPLOAD IMAGES) */
const storage = multer.diskStorage({
  destination: function(req, file, cb){ cb(null,"public/uploads/") },
  filename: function(req, file, cb){ cb(null, Date.now()+"-"+file.originalname) }
})
const upload = multer({storage:storage})

// ================== משתנים ==================
let users = []
let questions = []

// טעינת השאלות מקובץ JSON
try {
  questions = JSON.parse(fs.readFileSync("questions.json", "utf8"))
} catch (err) {
  console.log("לא נמצא questions.json או הקובץ ריק, מתחילים עם מערך ריק")
  questions = []
}

// פונקציה לשמירת השאלות
function saveQuestions() {
  fs.writeFileSync("questions.json", JSON.stringify(questions, null, 2))
}

// יוצרים מנהל כברירת מחדל
users.push({username:"admin1", password:"123", role:"admin"});
console.log("מנהל admin1 נוצר בהצלחה!");

// ==============================
// פונקציה לבדיקה אם המשתמש מנהל
function checkAdmin(req, res, next) {
    let user = users.find(u => u.username === req.session.user)
    if (!user || user.role !== "admin") {
        return res.status(403).json({error: "אין הרשאה, רק מנהל יכול לבצע"})
    }
    next()
}
// ==============================

/* REGISTER עם role */
app.post("/register",(req,res)=>{
    let {username,password,role} = req.body
    role = role || "user"
    if(users.find(u=>u.username===username)) return res.json({error:"user exists"})

    users.push({username,password,role})
    req.session.user = username
    res.json({success:true})
})

/* LOGIN */
app.post("/login",(req,res)=>{
    let {username,password} = req.body
    let user = users.find(u=>u.username===username && u.password===password)
    if(!user) return res.json({error:"wrong"})

    req.session.user = username
    res.json({success:true})
})

/* LOGOUT */
app.get("/logout",(req,res)=>{ req.session.destroy(()=>{res.sendStatus(200)}) })

/* CURRENT USER */
app.get("/me",(req,res)=>{
    if(!req.session.user) return res.json({user:null})
    let user = users.find(u=>u.username===req.session.user)
    res.json({user:req.session.user, avatar:user?.avatar, birthdate:user?.birthdate, bio:user?.bio})
})

/* EDIT PROFILE */
app.post("/editProfile", upload.single("avatar"), (req,res)=>{
    let user = users.find(u=>u.username===req.session.user)
    if(!user) return res.sendStatus(404)

    user.bio = req.body.bio
    user.birthdate = req.body.birthdate
    if(req.file) user.avatar = "/uploads/" + req.file.filename

    res.json({success:true})
})

/* DELETE AVATAR */
app.post("/deleteAvatar",(req,res)=>{
    let user = users.find(u=>u.username===req.session.user)
    if(!user) return res.sendStatus(404)

    user.avatar = ""
    res.json({success:true})
})

/* ASK QUESTION */
app.post("/questions",(req,res)=>{
    if(!req.session.user) return res.json({error:"login"})

    questions.push({ text:req.body.question, user:req.session.user, answers:[], time:Date.now(), views:0 })
    saveQuestions()

    res.sendStatus(200)
})

/* GET QUESTIONS */
app.get("/questions",(req,res)=>{ res.json(questions) })

/* DELETE QUESTION */
app.post("/deleteQuestion",(req,res)=>{
    let {id} = req.body
    if(!questions[id]) return res.sendStatus(404)

    questions.splice(id,1)
    saveQuestions()
    res.sendStatus(200)
})

/* VIEW QUESTION */
app.post("/view",(req,res)=>{
    let {id} = req.body
    if(!questions[id]) return res.sendStatus(404)

    questions[id].views++
    saveQuestions()
    res.sendStatus(200)
})

/* ADD ANSWER */
app.post("/answer",(req,res)=>{
    let {id,answer} = req.body
    if(!questions[id]) return res.sendStatus(404)

    let user = users.find(u=>u.username===req.session.user)

    questions[id].answers.push({ text:answer, user:req.session.user, avatar:user?.avatar, time:Date.now(), likes:0, dislikes:0, votes:{} })
    saveQuestions()

    res.sendStatus(200)
})

/* VOTE (LIKE / DISLIKE) */
app.post("/vote",(req,res)=>{
    let {questionId,answerId,type} = req.body
    let q = questions[questionId]; if(!q) return res.sendStatus(404)
    let a = q.answers[answerId]; if(!a) return res.sendStatus(404)

    let user = req.session.user; if(!user) return res.sendStatus(403)

    let prev = a.votes[user]
    if(prev === "like") a.likes--
    if(prev === "dislike") a.dislikes--

    if(prev === type){ delete a.votes[user] }
    else { a.votes[user] = type; if(type==="like") a.likes++; if(type==="dislike") a.dislikes++ }

    saveQuestions()
    res.sendStatus(200)
})

/* BEST ANSWER */
app.post("/bestAnswer",(req,res)=>{
    let {questionId,answerId} = req.body
    let q = questions[questionId]; if(!q) return res.sendStatus(404)

    q.best = answerId
    saveQuestions()
    res.sendStatus(200)
})

// הפעלת השרת
app.listen(3000,()=>{ console.log("Server running on http://localhost:3000") })
