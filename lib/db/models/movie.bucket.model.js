const db = require('../db.js')

// TODO Verify the effects of nesting on required and unique
let movieBucketSchema = new db.Schema({
	customID: {
		type: {
			step: {
				type: Number,
				required: [true, 'Bucket must have a step'],
			},
			category: {
				type: db.Types.ObjectId,
				ref: 'movies',
				required: [true, 'Bucket must have a category'],
			},
		},
	},
	count: { type: Number, default: 0, required: [true, 'Bucket must maintain a counter'] },
	bucket: { type: [db.Types.ObjectId], ref: 'movies' },
})

movieBucketSchema.index(
	{ 'customID.step': 1, 'customID.details': -1 },
	{ unique: [true, 'A bucket with these parameters already exists'] }
)

const movieBucketModel = db.model('movieBuckets', movieBucketSchema)
module.exports = movieBucketModel
