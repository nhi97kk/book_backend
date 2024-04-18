const express = require('express');
const authController = require('./../controllers/authController');
const postController = require('./../controllers/postController');

const router = express.Router();

router.use(authController.protect);

router
  .route('/')
  .get(postController.getAllPosts)
  .post(
    postController.uploadPostPhoto,
    postController.resizePostPhoto,
    postController.createPost
  );

router.get('/all/:userId', postController.getAllUserPosts);

router
  .route('/:id')
  .get(postController.getPost)
  .patch(postController.updatePost)
  .delete(postController.deletePost);

router.post('/:id/like', postController.likePost);

module.exports = router;
