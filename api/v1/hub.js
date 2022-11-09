const router = require('express').Router()
const multer = require('multer')
const categoryModel = require('../../lib/db/models/category.model')
const JSONResponse = require('../../lib/json.helper')
const S3Helper = require('../../lib/s3.helper')
const moviesController = require('./controllers/movies.controller')
const upload = multer()
const userController = require('./controllers/users.controller')
const typeCheck = require('./middleware/typeCheck.middleware')
const { bufferToStream } = require('../../lib/converters.helper')

/**
 * Generates the API Docs from the list of routes in the system and attaches descriptions to them
 * from the descriptions array, when you add routes, it will change on the next load to reflect new routes
 * automatically. They appear in the same order as they are written in the code, match the array descriptions
 * to this order.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
router.all('', (req, res) => {
	let concat = []
	for (let layer of router.stack) {
		concat.push({
			path: layer.route.path,
			methods: Object.keys(layer.route.methods),
		})
	}
	const descriptions = [
		`API DOCS URL`,
		`Manage users as a CRUD collection where an ID is not needed.
		POST to Sign Up
		GET to validate a session or (admin) Get users as CRUD collection with pagination and filtration
		PATCH to update the current user
		DELETE to delete the current user`,
		`Logs a user in.`,
		`Verification route for a newly registered account.`,
		`Administrative management of users as a CRUD collection via IDs.
		GET any user by ID
		PATCH any user by ID
		DELETE any user by ID`,
		`Route for managing logins and session resumption for admins.`,
		`Route for collecting all movies or (admin)creating an item.`,
		`Administrative management of movies via IDs.`,
		`Destroy the session and thereby log-out.`,
	]
	let body = {
		name: 'BasicAPI v1',
		version: '1.3.0',
		routes: concat,
		description: descriptions,
	}
	res.render('summary', body)
})

router
	.route('/users')
	.post(userController.signUp)
	.get(userController.session, typeCheck(['admin']), userController.get)
	.patch(userController.updateUser)
	.delete(userController.destroyUser)

router.all('/users/login', userController.signIn)

router.all('/users/verify/:id(^[a-fA-Fd]{24}$)', userController.verifyUser)

router
	.route('/users/:id(^[a-fA-Fd]{24}$)')
	.all(typeCheck(['admin']))
	.get(userController.getId)
	.patch(userController.updateUserAny)
	.delete(userController.destroyUserAny)

router
	.route('/movies')
	.all(typeCheck(['user', 'admin']))
	.get(moviesController.get)
	.post(upload.fields([{ name: 'image' }, { name: 'clip', maxCount: 1 }]), moviesController.add)
router
	.route('/movies/:id(^[a-fA-Fd]{24}$)')
	.all(typeCheck(['admin']))
	.patch(
		upload.fields([{ name: 'image' }, { name: 'clip', maxCount: 1 }]),
		moviesController.update
	)
	.delete(moviesController.destroy)

router.route('/categories').get(async (req, res) => {
	let categories = await categoryModel.find().catch((err) => {
		JSONResponse.error(req, res, 500, 'Database Error', err)
	})
	if (categories && categories.length > 0) {
		const index = categories.indexOf('6369a13a274f9c5d48860101')
		if (index > -1) {
			categories.splice(index, 1)
		}
		JSONResponse.success(req, res, 200, 'Collected matching documents', categories)
	} else JSONResponse.success(req, res, 200, 'Could not find any matching documents')
})

router.route('/logout').all(logout)

router.route('/s3/:key').get(typeCheck(['user', 'admin']), async (req, res) => {
	let file = await S3Helper.download(req.params.key).catch((err) => {
		console.error(err)
		JSONResponse.error(req, res, 500, 'Failed to communicate with file storage')
	})
	let responseStream = bufferToStream(file.Body)
	if (file) {
		responseStream.pipe(res)
		res.end()
	} else JSONResponse.error(req, res, 404, 'File not found')
})

module.exports = router

/**
 * Destroy the session
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function logout(req, res) {
	JWTHelper.killToken(req, res, 'jwt_auth')
	JSONResponse.success(req, res, 200, 'Logged out successfully!')
}
