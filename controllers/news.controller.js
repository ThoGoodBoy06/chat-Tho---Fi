const { createNewsFeedService } = require('../services/news_feed.service');
const { createNewsImageService } = require('../services/news_image.service');
const { createNewsArticleService } = require('../services/news_article.service');
const newsFeeds = createNewsFeedService();
const lookup = async id => (await newsFeeds.getLatest()).data.find(article => article.id === id);
const newsImages = createNewsImageService({lookup});
const articles = createNewsArticleService({lookup});
const articleImages = createNewsImageService({lookup: id => articles.findImage(id),
    width:1440, maximumInputBytes:12 * 1024 * 1024});

function sendImage(res, buffer) {
    res.set({'Content-Type':'image/webp', 'Cache-Control':'public, max-age=3600',
        'Access-Control-Allow-Origin':'*', 'Cross-Origin-Resource-Policy':'cross-origin'});
    return res.send(buffer);
}
const getNewsImage = async (req, res) => {
    try { return sendImage(res, await newsImages.get(req.params.id)); }
    catch (error) {res.set('Cache-Control','no-store');return res.status(error.status || 502).end();}
};
const getArticleImage = async (req, res) => {
    try {
        const article = await articles.get(req.params.id);
        if (!article.blocks.some(block => block.type === 'image' && block.imageId === req.params.imageId)) {
            return res.status(404).end();
        }
        return sendImage(res, await articleImages.get(req.params.imageId));
    } catch (error) {res.set('Cache-Control','no-store');return res.status(error.status || 502).end();}
};
const getLatestNews = async (req, res) => {
    try {
        const result = await newsFeeds.getLatest(req.query.category);
        res.set('Cache-Control', result.success ? 'public, max-age=60' : 'no-store');
        return res.status(result.success ? 200 : 503).json(result);
    } catch (error) {
        return res.status(error.status || 503).json({success:false, data:[],
            message:error.status === 400 ? error.message : 'Không tải được tin tức. Vui lòng thử lại.'});
    }
};
const getNewsContent = async (req, res) => {
    try {
        const data = await articles.get(req.params.id);
        res.set('Cache-Control', data.available ? 'public, max-age=300' : 'no-store');
        return res.json({success:true, data});
    } catch (error) {
        return res.status(error.status || 503).json({success:false,
            message:error.status === 404 ? 'Không tìm thấy bài báo.' : 'Không tải được bài báo. Vui lòng thử lại.'});
    }
};
module.exports = {getLatestNews, getNewsImage, getNewsContent, getArticleImage};
