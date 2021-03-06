// Our dependancies
var express = require("express");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");

// Our scraping tools
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, {
  useMongoClient: true
});

// Routes

// A GET route for scraping the website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  axios.get("http://www.cracked.com/").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

    // Now, we grab every div with an content-card tag, and do the following:
    $("div.content-card-content").each(function(i, element) {
      // Save an empty result object
      var result = {};

      // Add the title, summary and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children.children("a")
        .text();
      console.log(`Title: ${result.title}`)
      result.link = $(this)
        .parent("a")
        .attr("href");
      console.log(`Link: ${result.link}`)
      result.summary = $(this)
        .children("p")
        .text();
      console.log(`Summary: ${result.sumamry}`)

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function(dbArticles) {
          // View the added result in the console
          console.log(dbArticles);
        })
        .catch(function(err) {
          // If an error occurred, send it to the client
          return res.json(err);
        });
    });

    // If we were able to successfully scrape and save an Article, send a message to the client
    res.send("Scrape Complete");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Route so it grabs all of the articles
  db.Article.find({})
  .then(function(dbArticles) {
    // If all articles are successfully found, send them back to the client
    res.json(dbArticles);
  })
  .catch(function(err) {
    // If an error occurs, send the error back to the client
    res.json(err);
  });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Route so it finds one article using the req.params.id,
  db.Article.find({ _id: req.params.id })
  // and run the populate method with "note",
  .populate("note")
  // then responds with the article with the note included
    .then(function(dbArticles) {
      res.json(dbArticles);
    })
    .catch(function(err) {
      // if there's an error, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // save the new note that gets posted to the Notes collection
  // then find an article from the req.params.id
  // and update it's "note" property with the _id of the new note
  db.Article.create(req.body)
    .then(function(dbArticles) {
      // If a Note was created successfully, find one User (there's only one) and push the new Note's _id to the User's `notes` array
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.User.findOneAndUpdate({}, { $push: { notes: dbArticles._id } }, { new: true });
    })
    .then(function(dbUser) {
      // If the User was updated successfully, send it back to the client
      res.json(dbUser);
    })
    .catch(function(err) {
      // If an error occurs, send it back to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
