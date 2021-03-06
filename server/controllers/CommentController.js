import JRes from '../util/JResponse'
import Helpers from '../util/Helpers'
import Model from '../config/Database'

// comment to fix filename

export default class CommentController {

  /**
   * Method for creating a comment
   * @param next - The next state to transition to
   */
  static * create(next) {
    const user = this.state.user
    const commentInfo = this.request.body

    // Validate comment info
    const valid = yield Helpers.validate(
      commentInfo,
      (new Model.Post).getRules(true)
    )

    // Return if validation is not passed
    if (!valid.success) {
      this.status = 400
      this.body = valid
      return
    }

    // Set comment's user
    commentInfo.user_id = user.id

    const comment = new Model.Comment(commentInfo)
    const result = yield comment.save()
    .then(comment => {
      return JRes.success('Successfully created comment!', {
        comment: Helpers.transformObj(comment.attributes, [
          'id', 'title', 'description', 'type', 'creator_id', 'created_at'
        ])
      })
    })
    .catch(error => {
      return JRes.failure('Failed to create comment!', error.message)
    })

    if (!result.success) this.status = 400
    this.body = result
  }

  /**
   * Method for finding a comment by ID
   * @param next - The next state to transition to
   */
  static * findOne(next) {
    const commentId = this.params.id

    // Find comment by ID
    const result = yield Model.Comment
    .query({ where: { id: commentId } }).fetch()
    .then(comment => {
      if (!comment) {
        return JRes.failure('Unable to find comment with provided ID')
      }

      return JRes.success('Successfully fetched comment by ID', {
        comment: Helpers.transformObj(comment.attributes, [
          'post_id', 'user_id', 'body', 'created_at'
        ])
      })
    })
    .catch(err => {
      return JRes.failure(err)
    })

    if (!result.success) this.status = 400
    this.body = result
  }

  /**
   * Method for updating a comment
   * @param next - The next state to transition to
   */
  static * update(next) {
    const user = this.state.user
    const commentId = this.params.id
    const commentInfo = this.request.body

    // Validate comment info
    const valid = yield Helpers.validate(
      commentInfo,
      (new Model.Post).getRules()
    )

    // Return if validation is not passed
    if (!valid.success) {
      this.status = 400
      this.body = valid
      return
    }

    // Get comment
    const comment = yield Model.Comment
    .query({ where: { id: commentId } }).fetch()
    .then(comment => {
      if (!comment) {
        return JRes.failure('Unable to find comment with provided ID')
      }

      return JRes.success('Successfully fetched comment by ID', { comment })
    })
    .catch(err => {
      return JRes.failure(err)
    })

    // If failure to find comment, return
    if (!comment.success) {
      this.status = 400
      this.body = comment
      return
    }

    // If authenticated user is not the owner, return
    if (comment.data.comment.attributes.user_id !== user.id) {
      this.status = 400
      this.body = JRes.failure(`You cannot edit a comment that isn't yours`)
      return
    }

    // Update post
    const result = yield comment.data.comment.save(commentInfo)
    .then(updated => {
      if (updated) {
        return JRes.success('Successfully updated comment!')
      } else {
        return JRes.failure('Failed to update comment')
      }
    })
    .catch(err => {
      return JRes.failure(err)
    })

    if (!result.success) this.status = 400
    this.body = result
  }

  /**
   * Method for deleting a comment
   * @param next - The next state to transition to
   */
  static * delete(next) {
    const user = this.state.user
    const commentId = this.params.id

    // Get comment
    const comment = yield Model.Comment
    .query({ where: { id: commentId } }).fetch()
    .then(comment => {
      if (!comment) {
        return JRes.failure('Unable to find comment with provided ID')
      }

      return JRes.success('Successfully fetched comment by ID', { comment })
    })
    .catch(err => {
      return JRes.failure(err)
    })

    // If failure to find comment, return
    if (!comment.success) {
      this.status = 400
      this.body = comment
      return
    }

    // If authenticated user is not the owner, return
    if (comment.data.comment.attributes.user_id !== user.id) {
      this.status = 400
      this.body = JRes.failure(`You cannot edit a comment that isn't yours`)
      return
    }

    // Delete comment
    const result = yield comment.data.comment.destroy()
    .then(deleted => {
      if (deleted) {
        return JRes.success('Successfully deleted comment!')
      } else {
        return JRes.failure('Failed to delete comment')
      }
    })
    .catch(err => {
      return JRes.failure(err)
    })

    if (!result.success) this.status = 400
    this.body = result
  }
}
