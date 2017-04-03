// Import node modules
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import validateUUID from 'uuid-validate'

// Import utilities
import JRes from '../util/JResponse'
import Helpers from '../util/Helpers'
import SendError from '../util/SendError'
import Responses from '../util/Responses'

// Import Bookshelf to use knex query
import Bookshelf from '../config/Bookshelf'

// Import models
import User from '../models/User'
import Profile from '../models/Profile'
import Message from '../models/Message'
import Post from '../models/Post'

export default class UserController {
  /**
   * Method for creating a new user
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async create(ctx, next) {
    const userInfo = ctx.request.body

    // Validate user info
    await User.validate(User.rules, userInfo, true)

    // Create user
    const user = await User.create(userInfo)
    if (!user) {
      return SendError(ctx, 400, Responses.CREATE_USER_FAILURE, user)
    }

    // Sanitize user info
    const outputUser = Helpers.transformObj(
      user.attributes, ['id', 'username', 'email']
    )

    // Create user profile
    Profile.create({ user_id: user.id })

    // Create/Sign JWT
    const token = jwt.sign(outputUser, process.env.JWT_SECRET, { expiresIn: '14 days' })

    // Send response
    ctx.body = JRes.success(Responses.CREATE_USER_SUCCESS, {
      user: outputUser,
      token
    })
  }

  /**
   * Method for updating a user's immediate information
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async updateUser(ctx, next) {
    const currUser = ctx.state.user
    const userId = ctx.params.id
    const userInfo = ctx.request.body

    // Check permissions
    if (currUser.id !== userId && currUser.attributes.role !== 'admin') {
      return SendError(ctx, 400, Responses.NOT_AUTORIZED)
    }

    // Validate user info
    await User.validate(User.rules, userInfo, false)

    // Find user by ID
    const user = await User.find(userId)
    if (!user) {
      return SendError(ctx, 400, Responses.UPDATE_USER_FAILURE, user)
    }

    // Update user
    const result = await User.update(user, userInfo)
    if (!result) {
      return SendError(ctx, 400, user)
    }

    // Sanitize user info
    const outputUser = Helpers.transformObj(
      user.attributes, ['id', 'username', 'email', 'role', 'created_at']
    )

    // Send response
    ctx.body = JRes.success(Responses.UPDATE_USER_SUCCESS, { user: outputUser })
  }

  /**
   * Method for updating a user's profile information
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async updateProfile(ctx, next) {
    const currUser = ctx.state.user
    const userId = ctx.params.id
    const profileInfo = ctx.request.body

    // Check permissions
    if (currUser.id !== userId && currUser.attributes.role !== 'admin') {
      return SendError(ctx, 403, Responses.NOT_AUTHORIZED)
    }

    // Validate user info
    await Profile.validate(Profile.rules, profileInfo, false)

    // Find user by ID
    const user = await User.find(userId)
    if (!user) {
      return SendError(ctx, 400, Responses.USER_NOT_FOUND, user)
    }

    // Fetch profile, and save new profile info
    const profile = await user.profile().fetch()
    const result = await Profile.update(profile, profileInfo)
    if (!result) {
      return SendError(ctx, 400, Responses.UPDATE_PROFILE_FAILURE, result)
    }

    // Send response
    ctx.body = JRes.success(Responses.UPDATE_PROFILE_SUCCESS, {
      user: Helpers.transformObj(user.attributes, [
        'id', 'username', 'email', 'role', 'created_at'
      ]),
      profile: Helpers.transformObj(result.attributes, [
        'first_name', 'last_name', 'profession', 'skill_level', 'description',
        'github_url', 'dribbble_url', 'linkedin_url', 'portfolio_url'
      ])
    })
  }

  /**
   * Method for updating a user's password
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async updatePassword(ctx, next) {
    const currUser = ctx.state.user
    const userId = ctx.params.id
    const oldPassword = ctx.request.body.oldPassword
    let newPassword = ctx.request.body.newPassword

    // Check if passwords are provided
    if (!oldPassword || !newPassword) {
      return SendError(ctx, 400, Responses.REQUIRED_FIELDS_NOT_FOUND)
    }

    // Check permissions
    if (currUser.attributes.username !== userId && currUser.id !== userId && currUser.attributes.role !== 'admin') {
      return SendError(ctx, 403, Responses.NOT_AUTHORIZED)
    }

    // Find user by ID
    const user = await User.find(userId)
    if (!user) {
      return SendError(ctx, 400, Responses.USER_NOT_FOUND, user)
    }

    // Compare password to current password
    if (!bcrypt.compareSync(oldPassword, user.attributes.password)) {
      return SendError(ctx, 400, Responses.INCORRECT_PASSWORD)
    }

    // Hash new password
    newPassword = bcrypt.hashSync(newPassword, 10)

    // Set new password
    const result = await User.update(user, { password: newPassword })
    if (!result) {
      return SendError(ctx, 400, Responses.UPDATE_PASSWORD_FAILURE, user)
    }

    // Send response
    ctx.body = JRes.success(Responses.UPDATE_PASSWORD_SUCCESS)
  }

  /**
   * Method for finding a user by ID
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async findOne(ctx, next) {
    const userId = ctx.params.id

    // Find user model with profile
    const opts = { withRelated: ['profile'] }
    let user = null

    if (validateUUID(ctx.params.id)) {
      user = await User.find(userId, opts)
    } else {
      user = await User.findByUsername(userId, opts)
    }

    if (!user) {
      return SendError(ctx, 400, Responses.USER_NOT_FOUND, user)
    }

    // Send response
    ctx.body = JRes.success(Responses.SHOW_USER_SUCCESS, {
      user: Helpers.transformObj(user.attributes, [
        'id', 'username', 'email', 'role', 'created_at'
      ]),
      profile: Helpers.transformObj(user.relations.profile.attributes, [
        'first_name', 'last_name', 'profession', 'skill_level', 'description',
        'github_url', 'dribbble_url', 'linkedin_url', 'portfolio_url'
      ])
    })
  }

  /**
   * Method for finding a user's post
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async findPosts(ctx, next) {
    const userId = ctx.params.id
    let user = null

    // Limit/offset
    let start = 0
    let count = 10

    // Validate and set start offset
    if (ctx.request.query.start && ctx.request.query.start >= 0) {
      start = ctx.request.query.start
    }

    // Validate and set end offset
    if (ctx.request.query.count && ctx.request.query.count > 0) {
      count = ctx.request.query.count
    }

    // Get user
    if (validateUUID(userId)) {
      user = await User.find(userId)
    } else {
      user = await User.findByUsername(userId)
    }

    if (!user) {
      return SendError(ctx, 400, Responses.USER_NOT_FOUND, user)
    }

    const opts = { withRelated: ['comments', 'user'] }
    let posts = await Post.query(qb => {
      qb.where('user_id', '=', user.id)
      qb.orderBy('created_at', 'desc')
      qb.limit(count).offset(start)
    }).fetchAll(opts)

    if (!posts) {
      return SendError(ctx, 400, Responses.NO_POSTS_FOUND, posts)
    }

    // Serialize so we can iterate through results
    const serialized = posts.serialize()

    // Iterate over comments, and fetch users associated with comments
    // TODO (FUTURE): Use a raw query to fetch this shit so no need for these loops
    for (let i = 0; i < serialized.length; i++) {
      for (let c = 0; c < serialized[i].comments.length; c++) {
        const user = await User.find(serialized[i].comments[c].user_id)
        serialized[i].comments[c]['user'] = Helpers.transformObj(user.attributes, [
          'id', 'username', 'email'
        ])
        delete serialized[i].comments[c]['user_id']
      }
    }

    // Send response
    ctx.body = JRes.success(Responses.SHOW_USER_POSTS_SUCCESS, {
      posts: Helpers.transformArray(serialized, [
        'id',
        { attribute: 'user', fields: ['id', 'username', 'email'] },
        'title', 'description', 'type', 'created_at',
        { attribute: 'comments', fields: ['id', 'user', 'body', 'created_at'] }
      ])
    })
  }

  /**
   * Method for finding a user's chats
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async findChats(ctx, next) {
    const currUser = ctx.state.user
    const userId = ctx.params.id
    let user = null

    // Check permissions
    if (currUser.attributes.username !== userId && currUser.id !== userId && currUser.attributes.role !== 'admin') {
      return SendError(ctx, 403, Responses.NOT_AUTHORIZED)
    }

    // Find user by ID
    if (validateUUID(ctx.params.id)) {
      user = await User.find(userId)
    } else {
      user = await User.findByUsername(userId)
    }

    if (!user) {
      return SendError(ctx, 400, Responses.USER_NOT_FOUND, user)
    }

    // Find chats
    let chats = await Message.query(qb => {
      qb.distinct('room_id')
      qb.where('room_id', 'LIKE', '%' + user.id + '%')
    }).fetchAll()

    chats = chats.serialize()

    // TODO: Find out how to replace this with a join/relationship

    for (let i = 0; i < chats.length; i++) {
      let otherUserId = chats[i].room_id.replace(user.id, '').replace(':', '')
      delete chats[i].room_id

      const otherUser = await User.find(otherUserId)
      chats[i]['user'] = Helpers.transformObj(otherUser.attributes, [
        'id', 'username', 'email'
      ])
    }

    // Send response
    ctx.body = JRes.success(Responses.SHOW_CHATS_SUCCESS, { chats })
  }

  /**
   * Method for finding a user's notifications
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async findNotifications(ctx, next) {
    const currUser = ctx.state.user
    const userId = ctx.params.id
    let user = null

    // Check permissions
    if (currUser.attributes.username !== userId && currUser.id !== userId && currUser.attributes.role !== 'admin') {
      return SendError(ctx, 403, Responses.NOT_AUTHORIZED)
    }

    // Find user by ID
    if (validateUUID(ctx.params.id)) {
      user = await User.find(userId)
    } else {
      user = await User.findByUsername(userId)
    }

    if (!user) {
      return SendError(ctx, 400, Responses.USER_NOT_FOUND, user)
    }

    // Find notifications
    const opts = { withRelated: ['from_user'] }
    const notifications = await Notification.findByUserId(user.id, opts)
    if (!notifications) {
      return SendError(ctx, 400, Responses.NO_NOTIFICATIONS_FOUND, notifications)
    }

    // Send response
    ctx.body = JRes.success(Responses.SHOW_NOTIFICATIONS_SUCCESS, {
      notifications: Helpers.transformArray(notifications.serialize(), [
        { attribute: 'from_user', fields: ['id', 'username', 'email'] },
        'type', 'created_at'
      ])
    })
  }

  /**
   * Method for clearing a user's notifications
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async clearNotifications(ctx, next) {
    const currUser = ctx.state.user
    const userId = ctx.params.id
    let user = null

    // Check permissions
    if (currUser.attributes.username !== userId && currUser.id !== userId && currUser.attributes.role !== 'admin') {
      return SendError(ctx, 403, Responses.NOT_AUTHORIZED)
    }

    // Find user by ID
    if (validateUUID(ctx.params.id)) {
      user = await User.find(userId)
    } else {
      user = await User.findByUsername(userId)
    }

    if (!user) {
      return SendError(ctx, 400, Responses.USER_NOT_FOUND, user)
    }

    const updated = await Bookshelf.knex('notifications')
      .where('to_user', '=', user.id)
      .andWhere('read', '=', false)
      .update({ read: true })

    // Send response
    ctx.body = JRes.success(Responses.NOTIFICATIONS_CLEARED)
  }

  /**
   * Method for checking if user info exists (front-end)
   * @param ctx - The current request context
   * @param next - The next state to transition to
   */
  static async checkExisting(ctx, next) {
    const { field, value } = ctx.params
    const conditionalWhere = {}
    conditionalWhere[field] = value

    const user = await User.query({ where: conditionalWhere }).fetch()
    if (user) {
      ctx.body = JRes.failure(Responses.USER_EXISTS)
      return
    }

    ctx.body = JRes.success(Responses.USER_NOT_FOUND)
  }
}
