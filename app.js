var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var fileUpload = require('express-fileupload');
var cors = require('cors');
var fs = require('fs');
var unzip = require('unzip');
var app = express();
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
var books = new PouchDB("book");
var reviews = new PouchDB("review");
var chapters = new PouchDB("chapter");
var tags = new PouchDB("tag");
var PouchDBFolder = PouchDB.defaults({prefix: '/PouchDB/'});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public'),{extensions:['png','jpg']}))
app.use('/db', require('express-pouchdb')(PouchDB));
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use(cors());
app.use(fileUpload());

// catch 404 and forward to error handler
app.post('/upload', (req, res, next) => {
  
  let file = req.files.file;
  console.log(req.files.file.mimetype);
  if(file.mimetype === "image/jpeg" ||file.mimetype === "image/png" ||file.mimetype === "image/jpeg" ||file.mimetype === "application/octet-stream"){
    file.mv(`${__dirname}/public/${file.name}`, function(err) {
      if (err) {
        return res.status(500).send(err);
      }
      if(file.mimetype === "application/octet-stream"){
        
        const spawn = require('child_process').spawn;
        const ls = spawn('python', ['public/cbxmanager.py', `${__dirname}/public/${file.name}`]);

        ls.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });

        ls.stderr.on('data', (data) => {
          console.log(`stderr: ${data}`);
        });

        ls.on('close', (code) => {
          console.log(`child process exited with code ${code}`);
        });
        //fs.unlink(`${__dirname}/public/${file.name}`);
        res.json({file: `public/${file.name}`,status:"Comic was uploaded and unzipped at " + `${file.name.substring(0, file.name.lastIndexOf('.'))}`});
      }else{
        res.json({file: `public/${file.name}`,status:"image was uploaded at " + `${file.name}`});
      }
    
    });
  }else{
    res.json({status: "This is not a valid file type!"});
  }
});

/*app.get("/CreateTags",function(req,res){
  let tag = ["4-Koma","Action","Adventure","Award Winning","Comedy","Cooking","Doujinshi","Drama","Ecchi","Fanstasy","Gender Bender","Harem","Historical","Horror","Isekai","Josei","Martial Arts","Mecha","Medical","Music","Mystery","Oneshot","Psychological","Romance","School Life","Sci-Fi","Seinen","Shoujo","Shoujo Ai","Shounen","Slice of life","Smut","Sports","Supernatural","Tragedy","Webtoon","Yuri","Game"]
  let tags =[]
  tag.map
  tag.map((el,index) => {
    tags.push({_id: el})
  });
  var tagse = new PouchDB("tag");
  
  tagse.bulkDocs(tags).then(response => {
    return true
  }).catch(err => console.log(err));
  res.send(tagse);
})*/
app.post("/addBook", function(req,res){
  const book ={
    _id : req.body.title,
    author :  req.body.author,
    artist :  req.body.artist,
    rating : 0.00,
    status : req.body.status,
    description : req.body.description,
    tags: req.body.tags.split(","),
  }
  let file = req.files.file;
  books.put(book).then((response) => {
  fileName = response.id.replace(/[/\\?%*:|"<>. ]/g, '-');
  fs.mkdirSync(`${__dirname}/public/books/${fileName}`);
  file.mv(`${__dirname}/public/thumbnails/${fileName}.${file.name.split('.').pop()}`, function(err) {
    if (err) {
      return res.status(500).send(err);
    }else{
      res.json("Book added");
    }
  });
  
  }).catch(function (err) {
    res.json(err);
    // res.send(err);
  });
  
});
app.post("/addChapter",function(req,res){
  const chapter = {
    book_id : req.body.book_id,
    number : req.body.number,
    title : req.body.title,
    dateAdded : new Date().toDateString(),
  }
  chapters.post(chapter).then(response => {
    fs.mkdirSync(`${__dirname}/public/books/${req.body.book_id.replace(/[/\\?%*:|"<>. ]/g, '-')}/${req.body.number}-${req.body.title.replace(/[/\\?%*:|"<>. ]/g, '-')}`);
    res.send(response);
  }).catch(err => res.send(err));
 
});
app.post("/addReview",function(req,res){
  const Review = {
    book_id : req.body.book_id,
    user : req.body.userName,
    rating : req.body.rating,
    text: req.body.text,
    dateAdded : new Date().toDateString(),
  }
  reviews.post(Review).then(response => {
    res.send(response);
  }).catch(err => res.send(err));
 
});
app.get("/getBooks/:limit", function(req,res){
  books.allDocs({limit: req.params.limit * 10,skip:(req.params.limit * 10)-10,include_docs:true,endkey: '_design'}).then(response => {
    res.json(response);
    return true;
  }).catch(function (err) {
    res.json(err);
    return true;
  });
});
app.post("/getBooks",(req,res) => {
  console.log(req.body.id);
  books.createIndex({
    index: {
      fields: ['_id',"author","artist","status","tags"]
    }
  }).then(() => {
    return books.find({
      selector: {
        author : {$gte: req.body.id},
      },limit:req.body.page * 10,skip: req.body.page * 10 - 10
    }).then(response =>{
      console.log(response);
      res.json(response);
    } ).catch(err => console.log(err));
  }).catch(function (err) {
    res.json(err);
  });
});

app.get("/getBook/:id",(req,res) => {
  books.createIndex({
    index: {
      fields: ['_id']
    }
  }).then(() => {
    return books.find({
      selector: {
        _id : {$eq: req.params.id},
      }
    }).then(response =>{
      res.json(response);
    } ).catch(err => console.log(err));
  }).catch(function (err) {
    res.json(err);
  });
});
app.post("/Search/",(req,res) => {
  console.log(req.body);
  let INtags = req.body.INtags ? req.body.INtags.split(',') : [];
  let NORtags = req.body.INtags ?req.body.NORtags.split(',') : [];
  console.log(INtags,NORtags);
  books.createIndex({
    index: {
      fields: ['_id',"author","artist","status","tags"]
    }
  }).then(() => {
    return books.find({
      selector: {
        _id : {$regex : req.body.text},
        tags: {$all : INtags},
        tags: {$nin : NORtags},
      },
    }).then(response => {
      console.log(response);
      res.json(response);
      
    }).catch(err => console.log(err));
  }).catch(function (err) {
    res.json(err);
  });
  
});
app.get("/getChapters/:id",(req,res) => {
  chapters.createIndex({
    index: {
      fields: ['book_id','number']
    }
  }).then(() => {
    return chapters.find({
      selector: {
        book_id : {$eq : req.params.id},
      },
    }).then(response => res.json(response)).catch(err => console.log(err));
  }).catch(function (err) {
    res.json(err);
  });
  
});
app.get("/getChapterPages/:id/:chapter",(req,res) =>{
  chapters.createIndex({
    index: {
      fields: ['book_id','number']
    }
  }).then(() => {
    return chapters.find({
      selector: {
        book_id : {$eq : req.params.id},
        number: {$eq : req.params.chapter}
      },
    }).then(response =>{
      if(response.docs.length > 0){
        fs.readdir(`${__dirname}/public/books/${response.docs[0].book_id.replace(/[/\\?%*:|"<>. ]/g, '-')}/${response.docs[0].number}-${response.docs[0].title.replace(/[/\\?%*:|"<>. ]/g, '-')}`, (err, files) => {
        if(err){
          res.status(404).send("Chapter not found");
        }else{
          res.json({pages: files.length,chapterTitle : response.docs[0].title});
        }
      });
      }else{
        res.status(404).send("Chapter not found");
      }
      //console.log(response.docs[0].book_id,`${__dirname}/public/books/XD/1-deez`);

    }).catch(err => console.log(err));
  }).catch(function (err) {
    res.json(err);
  });
 
});
app.get("/getReviews/:id",(req,res) => {
  reviews.createIndex({
    index: {
      fields: ['book_id']
    }
  }).then(() => {
    return reviews.find({
      selector: {
        book_id : {$eq : req.params.id},
      },
    }).then(response => res.json(response)).catch(err => console.log(err));
  }).catch(function (err) {
    res.json(err);
  });
});
app.get("/getAllTags",(req,res) => {
  tags.allDocs().then(response => res.json(response)).catch(err => console.log(err));
})
app.get("/getPage/:book/:chapter/:page", function(req,res){
  let url = `${__dirname}/public/${req.params.book}/${req.params.chapter}/${req.params.page}`;
  if(fs.existsSync(url)){
    res.sendFile(url);
  }else{
    res.sendFile(`${__dirname}/public/ImageNotFound.png`);
  }
 
});
app.get("/getThumbNail/:id",(req,res)=>{
  let url = `${__dirname}/public/thumbnails/${req.params.id}`;
  if(fs.existsSync(url)){
    res.sendFile(url);
  }else{
    res.sendFile(`${__dirname}/public/ImageNotFound.png`);
  }
});
app.get("/dbs/:db/:id", function(req,res){
  var db = new PouchDB(req.params.db, { skip_setup: true })
  db.info().then(() => {
    db.find({
      selector: {
        title: {$eq: req.params.id}
      }
    }).then(response => {
      res.send(response);
    });
  })
  .catch(e => {
    res.send(e);
  });
});
app.get("/deleteBook/:id", function(req,res){
  books.remove(req.params.id).then(response => {
    res.send(response);
    return true;
  }).catch(function (err) {
    res.send(response);
    return true;
  });
});



app.use(function(req, res, next) {
  next(createError(404));
});
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;