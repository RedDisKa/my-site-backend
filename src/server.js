import express from "express";
import bodyParser from "body-parser";
import { MongoClient } from "mongodb";
import path from "path";

const app = express();

app.use(express.static(path.join(__dirname, "/build")));
app.use(bodyParser.json());

const withDB = async (operations, res) => {
  try {
    const client = await MongoClient.connect("mongodb://localhost:27017", {
      useNewUrlParser: true,
    });
    const db = client.db("my-site");

    await operations(db);

    client.close();
  } catch (error) {
    res.status(500).json({ message: "Error connecting to db", error });
  }
};

app.get("/api/tagsList", async (req, res) => {
  withDB(async (db) => {
    const articles = await db
      .collection("articles")
      .find({}, { projection: { _id: 0, tags: 1 } });
    const articlesResult = await articles.toArray();
    const tags = [];
    for (let k = 0; k < articlesResult.length; k++) {
      const article = articlesResult[k];
      for (let i = 0; i < article.tags.length; i++) {
        const currentTag = article.tags[i];
        let found = false;
        for (let j = 0; j < tags.length; j++) {
          if (tags[j].tag === currentTag) {
            tags[j].count = tags[j].count + 1;
            found = true;
          }
        }
        if (!found) {
          tags.push({ tag: currentTag, count: 1 });
        }
      }
    }
    res
      .status(200)
      .json(
        tags.sort((tagInfo1, tagInfo2) => tagInfo1.count >= tagInfo2.count)
      );
  }, res);
});

app.get("/api/articlesList", async (req, res) => {
  withDB(async (db) => {
    const articles = await db.collection("articles").find(
      {},
      {
        projection: {
          _id: 0,
          name: 1,
          title: 1,
          previewText: 1,
          tags: 1,
          createAt: 1,
        },
      }
    );
    res.status(200).json(await articles.toArray());
  }, res);
});

app.get("/api/articles/:name", async (req, res) => {
  withDB(async (db) => {
    const articleName = req.params.name;

    const articleInfo = await db
      .collection("articles")
      .findOne({ name: articleName });

    const relatedArticles = await db.collection("articles").find(
      {},
      {
        projection: {
          _id: 0,
          name: 1,
          title: 1,
          previewText: 1,
          createAt: 1,
          tags: 1,
        },
      }
    );

    res.status(200).json({
      ...articleInfo,
      relatedArticles: await relatedArticles.toArray(),
    });
  }, res);
});

app.post("/api/articles/:name/add-comment", (req, res) => {
  const { username, text } = req.body;
  const articleName = req.params.name;

  withDB(async (db) => {
    const articleInfo = await db
      .collection("articles")
      .findOne({ name: articleName });
    await db.collection("articles").updateOne(
      { name: articleName },
      {
        $set: {
          comments: articleInfo.comments.concat({ username, text }),
        },
      }
    );
    const updatedArticleInfo = await db
      .collection("articles")
      .findOne({ name: articleName });

    res.status(200).json(updatedArticleInfo);
  }, res);
});

app.post("/api/admin/add-new-article", (req, res) => {
  const { name, title, content, previewText, tags } = req.body;

  withDB(async (db) => {
    await db.collection("articles").insertOne({
      name,
      createAt: new Date(),
      title,
      content,
      previewText,
      tags,
      upvotes: 0,
      comments: [],
    });
    const updatedArticleInfo = await db
      .collection("articles")
      .findOne({ name });

    const relatedArticles = await db.collection("articles").find(
      {
        tags: tags,
      },
      { projection: { _id: 0, name: 1, title: 1, previewText: 1 } }
    );

    res.status(200).json({
      ...updatedArticleInfo,
      relatedArticles: await relatedArticles.toArray(),
    });
  }, res);
});

app.post("/api/admin/delete-article", (req, res) => {
  const { name } = req.body;

  withDB(async (db) => {
    await db.collection("articles").deleteOne({
      name,
    });
    const updatedArticleInfo = await db
      .collection("articles")
      .findOne({ name });

    res.status(200).json(!updatedArticleInfo);
  }, res);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/build/index.html"));
});

app.listen(8000, () => console.log("Listening on port 8000"));
