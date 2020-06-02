const express = require("express");
const mongo = require("mongodb");
const mongoose = require("mongoose");
const cors = require("cors");

mongoose.connect(process.env.MONGODB_URI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useFindAndModify: false
});

//var MongoClient = mongo.MongoClient;
//var url = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    count: Number,
    log: [
      {
        _id: false,
        description: { type: String },
        duration: { type: Number },
        date: { type: Date }
      }
    ]
  },
  { collection: "exercise_users", versionKey: false }
);

const User = mongoose.model("User", UserSchema);

const app = express();
app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

app.post("/api/exercise/new-user", (req, res) => {
  //console.log(req.body);
  const user = new User(req.body);
  user.save(req.body, (err, doc) => {
    if (err) {
      if (err.errmsg && err.errmsg.toString().match(/duplicate key/gi)) {
        return res.send("Username already taken");
      } else {
        return res.send(err);
      }
    } else {
      console.log(doc);
      return res.send({ _id: doc._id, username: doc.username });
    }
  });
});

app.get("/api/exercise/users", async (req, res) => {
  let results = await User.find({});
  console.log(results);
  let responseArr = [];
  for (var obj in results) {
    let response = {
      userId: results[obj]._id,
      username: results[obj].username
    };
    responseArr.push(response);
  }
  return res.json(responseArr);
});


app.post("/api/exercise/add", (req, res) => {
  
  console.log(req.body);
  
  var d = new Date();
  let yyyy = d.getFullYear();
  let mm = d.getMonth() + 1 < 10 ? "0" + d.getMonth() + 1 : d.getMonth() + 1;
  let dd = d.getDate() < 10 ? "0" + d.getDate() : d.getDate();

  if (!req.body.userId || !req.body.description || !req.body.duration) {
    return res.json({ error: "Please fill out all required fields and try again" });
  } else {
    let exercise = {
      description: req.body.description,
      duration: req.body.duration
    };
    if (!req.body.date) {
      exercise.date = new Date(`${yyyy}-${mm}-${dd}`);
    } 
    else if (Number(req.body.date.split('-')[1]) > 12) {
      return res.json({ error: "The date provided is not in the correct format, please try again" });
    } else {
      exercise.date = new Date(req.body.date);
    }
    User.findOneAndUpdate(
      {
        _id: req.body.userId
      },
      {
        $inc: {
          count: 1
        },
        $push: {
          log: exercise
        }
      },
      {
        new: true
      },
      (err, result) => {
        if (err) {
          return res.json(err);
        }
        if (result) {
          console.log(result);
          return res.json({
            userId: result._id,
            description: exercise.description,
            duration: exercise.duration,
            date: exercise.date.toDateString(),
            username: result.username
          });
        } else {
          return res.send(`No match for id ${req.body.userId}`);
        }
      }
    );
  }
});

app.get("/api/exercise/log", (req, res) => {
  console.log("/api/exercise/log:");
  console.log(req.query);

  let to = req.query.to;
  let from = req.query.from;

  User.findOne(
    {
      _id: req.query.userId
    },
    (err, result) => {
      if (err) {
        return res.json({ error: err });
      }

      if (result) {
        //console.log(result)
        let log = [...result.log];
        console.log(log);
        if (req.query.from) {
          log = log.filter(a => a.date > new Date(req.query.from));
        }
        if (req.query.to) {
          log = log.filter(a => a.date < new Date(req.query.to));
        }
        if (req.query.limit) {
          log = log.filter(a => Number(a.duration) <= Number(req.query.limit));
        }

        log = log
          .sort((a, b) => a.date > b.date)
          .map(obj => ({
            description: obj.description,
            duration: obj.duration,
            date: obj.date.toDateString()
          }));

        //console.log({
        //  userId: result._id,
        //  username: result.username,
        //  count: result.count,
        //  log: log
        //})
        //return res.json(result)
        return res.json({
          userId: result._id,
          username: result.username,
          count: result.count,
          log: log
        });
      } else {
        return res.send(`No match for id ${req.query.userId}`);
      }
    }
  );
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
