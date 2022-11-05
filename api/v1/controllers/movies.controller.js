const movieBucketModel = require('../../../lib/db/models/movie.bucket.model')
const movieModel = require('../../../lib/db/models/movie.model')
const JSONResponse = require('../../../lib/json.helper')

class moviesController {
	// TODO Research into populate, in order to fill movie references in the bucket
	//Read
	/**
	 * Get collective movies
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async get(req, res) {
		let { page, limit, field, value } = req.query
		if (page && limit && [10, 20, 25, 50].includes(limit) && page > 0) {
			let bucket = Math.floor((page * limit) / 100)
			let indexStart = (page * limit) % 100
			let filterBody = {}
			if (field.length == value.length) {
				field.forEach((e, index) => {
					filterBody[e] = value[index]
				})
			}
			const list = await movieBucketModel
				.findOne({
					customID: { step: bucket, details: new Map(Object.entries(filterBody)) },
				})
				.catch((err) => {
					JSONResponse.error(req, res, 500, 'Database Error', err)
				})
			if (list.length > 0) {
				let subArray = list.slice(indexStart, indexStart + limit)
				JSONResponse.success(req, res, 200, 'Collected matching documents', subArray)
			} else JSONResponse.error(req, res, 404, 'Could not find any matching documents')
		} else {
			JSONResponse.error(req, res, 501, 'Incorrect query string')
			return
		}
	}

	/**
	 * Get an movie by ID
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async getOne(req, res) {
		let id = req.params.id
		let movie = await movieModel.findById(id).catch((err) => {
			JSONResponse.error(req, res, 500, 'Database Error', err)
		})
		if (movie) {
			JSONResponse.success(req, res, 200, 'Collected matching document', movie)
		} else JSONResponse.error(req, res, 404, 'Could not find any matching documents')
	}

	// TODO Include buckets interactions
	//Create
	/**
	 * Create a new movie
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async add(req, res) {
		let body = req.body
		let newdoc = new movieModel(body)
		let now = Date.now().toString(16)
		let manageupload = await S3Helper.upload(req.files['image'], now + '_img')
		if (manageupload) body.image = now + '_img'
		manageupload = await S3Helper.upload(req.files['clip'], now + '_clip')
		if (manageupload) body.clip = now + '_clip'
		let valid = true
		await newdoc.validate().catch((err) => {
			invalid = false
			JSONResponse.error(
				req,
				res,
				400,
				err.errors[Object.keys(err.errors)[Object.keys(err.errors).length - 1]].properties
					.message,
				err.errors[Object.keys(err.errors)[Object.keys(err.errors).length - 1]]
			)
		})
		if (valid) {
			const newerdoc = await newdoc.save().catch((err) => {
				JSONResponse.error(req, res, 500, 'Database Error', err)
			})
			if (newerdoc)
				JSONResponse.success(req, res, 202, 'Document added successfully', newerdoc)
		}
	}

	//Delete
	/**
	 * Erase an movie by ID
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async destroy(req, res) {
		let id = req.params.id
		const olddoc = await movieModel.findByIdAndDelete(id).catch((err) => {
			JSONResponse.error(req, res, 500, 'Database Error', err)
		})

		if (olddoc) {
			JSONResponse.success(req, res, 200, 'Successfully removed document')
		} else {
			JSONResponse.error(req, res, 404, 'Could not find document')
		}
	}

	//Update
	/**
	 * Update an movie by ID
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	static async update(req, res) {
		let id = req.params.id
		let body = req.body
		const newdoc = await movieModel.findByIdAndUpdate(id, body).catch((err) => {
			JSONResponse.error(req, res, 500, 'Database Error', err)
		})
		if (newdoc) {
			JSONResponse.success(req, res, 200, 'Successfully updated document', newdoc)
		} else {
			JSONResponse.error(req, res, 404, 'Could not find document')
		}
	}
}

module.exports = moviesController
