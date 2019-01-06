var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const sharp = require('sharp');
var cors = require('cors');
var fs = require('fs');
var unzip = require('unzip');
var app = express();
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
var multer  = require('multer')
var upload = multer({ dest: 'public/' })
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

app.post('/upload/image',  upload.single('file'), function (req, res, next) {
  let file = req.file;
  fs.renameSync(`${__dirname}/public/${file.filename}`,`${__dirname}/public/books/${req.body.book_id.replace(/[/\\?%*:|"<>. ]/g, '-')}/${req.body.chapterName}/${file.originalname.split('.').slice(0, -1).join('.')}.jpg`)
  res.json("Done");
})

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
app.post("/addBook", upload.single('file'),function(req,res){
  const book ={
    _id : req.body.title,
    author :  req.body.author,
    artist :  req.body.artist,
    rating : 0.00,
    status : req.body.status,
    description : req.body.description,
    tags: req.body.tags.split(","),
  }
  let file = req.file;
  books.put(book).then((response) => {
    let fileName = response.id.replace(/[/\\?%*:|"<>. ]/g, '-');
    fs.mkdirSync(`${__dirname}/public/books/${fileName}`);
    fs.renameSync(`${__dirname}/public/${file.filename}`,`${__dirname}/public/thumbnails/${fileName}.jpg`)
    const readStream = fs.createReadStream(`${__dirname}/public/thumbnails/${fileName}.jpg`);
    let transform = sharp();
    transform.resize(180,null).toFile(`${__dirname}/public/thumbnails/${fileName}_s.jpg`);
    readStream.pipe(transform);
    res.json("OK");
  }).catch(function (err) {
    res.json(err);
    console.log(err);
  });
  
});
app.post("/addChapter",function(req,res){
  const chapter = {
    book_id : req.body.book_id,
    number : req.body.number,
    title : req.body.title,
    dateAdded : new Date().toDateString(),
    size : req.body.size,
    pages : req.body.pages,
    type : req.body.type,
  }
  console.log(`${__dirname}/public/books/${req.body.book_id.replace(/[/\\?%*:|"<>. ]/g, '-')}/${req.body.number}-${req.body.title.replace(/[/\\?%*:|"<>. ]/g, '-')}`);
  chapters.post(chapter).then(response => {
    fs.mkdirSync(`${__dirname}/public/books/${req.body.book_id.replace(/[/\\?%*:|"<>. ]/g, '-')}/${req.body.number}-${req.body.title.replace(/[/\\?%*:|"<>. ]/g, '-')}`,function(err){
      err ? console.log(err) : null;
    });
    res.json("Chapter Added");
  }).catch(err => res.json(err));
 
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
  books.createIndex({
    index: {
      fields: ['_id',"author","artist","status","tags"]
    }
  }).then(() => {
    return books.find({
      selector: {
        _id : {$regex : req.body.text},
        tags: {$all : req.body.INtags},
        tags: {$nin : req.body.NINtags},
      },
    }).then(response => {
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
