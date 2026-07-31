const express = require("express");
const router = express.Router();
const newsController = require("../controllers/news.controller");

router.get("/", newsController.getLatestNews);
router.get("/:id/content", newsController.getNewsContent);

module.exports = router;
