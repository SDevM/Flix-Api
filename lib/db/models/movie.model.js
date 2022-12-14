const JSONResponse = require('../../json.helper.js')
const S3Helper = require('../../s3.helper.js')
const db = require('../db.js')
const movieBucketModel = require('./movie.bucket.model.js')

let movieSchema = new db.Schema({
	title: {
		type: String,
		unique: [true, 'Such a movie already exists'],
		required: [true, 'No title provided'],
	},
	year: {
		type: String,
		required: [true, 'No year provided'],
	},
	rating: {
		type: String,
		required: [true, 'No rating provided'],
	},
	description: {
		type: String,
		required: [true, 'No description provided'],
	},
	categories: {
		type: [db.Types.ObjectId],
		required: [true, 'No categories provided'],
		ref: 'categories',
	},
	image: {
		type: String,
		required: [true, 'No S3 file key rendered'],
	},
	clip: {
		type: String,
		required: [true, 'No S3 file key rendered'],
	},
})

/**
 * Execute after saving an movie, in order to perform bucket logic
 * Add movie references to the relevant buckets, create a bucket if necessary
 */
movieSchema.post('save', async function (doc) {
	doc.categories.forEach(async (e) => {
		let bucket = await movieBucketModel
			.findOne({ 'customID.category': e, count: { $lt: 100 } })
			.sort({ 'customID.step': 'asc' })
			.catch((err) => {
				doc.delete()
				JSONResponse.error(req, res, 500, 'Database Error', err)
			})
		if (!bucket) {
			newBucket([doc._id], 1, e)
		} else {
			bucket.bucket.push(doc._id)
			bucket.count++
			bucket.save().catch((err) => {
				JSONResponse.error(req, res, 500, 'Database Error', err)
				return
			})
		}
	})

	/**
	 * Create a new bucket in the database
	 * @param {Number} step
	 */
	let newBucket = (addition, step, e) => {
		let newbucket = new movieBucketModel({
			customID: {
				step: step,
				category: e,
			},
			bucket: [],
		})
		newbucket.bucket.push(addition)
		newbucket.count++
		newbucket.save().catch((err) => {
			doc.delete()
			JSONResponse.error(req, res, 500, 'Database Error', err)
		})
	}
})

// TODO post for updateOne to perform s3 logic in the case of new files

/**
 * After deleting an movie, remove it from all buckets
 */
movieSchema.post('deleteOne', async function (doc) {
	await S3Helper.delete(doc.image).catch((err) => {
		JSONResponse.error(req, res, 500, 'S3 Error', err)
	})
	await S3Helper.delete(doc.clip).catch((err) => {
		JSONResponse.error(req, res, 500, 'S3 Error', err)
	})
	doc.categories.forEach(async (e) => {
		let buckets = await movieBucketModel.find({ 'customID.category': e }).catch((err) => {
			doc.delete()
			JSONResponse.error(req, res, 500, 'Database Error', err)
			return
		})
		buckets.forEach((bucket) => {
			if (Array.from(bucket.bucket).includes(doc._id))
				bucket.bucket = Array.from(bucket.bucket).filter((e) => {
					return e != doc._id
				})
			bucket.save().catch((err) => {
				JSONResponse.error(req, res, 500, 'Database Error', err)
			})
		})
	})
})

const movieModel = db.model('movies', movieSchema)
module.exports = movieModel
