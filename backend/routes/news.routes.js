const express = require("express");
const router = express.Router();
const newsController = require("../controllers/news.controller");

router.get("/", newsController.getLatestNews);
router.get("/image/:id", newsController.getNewsImage);
router.get("/:id/images/:imageId", newsController.getArticleImage);
router.get("/:id/content", newsController.getNewsContent);

module.exports = router;
