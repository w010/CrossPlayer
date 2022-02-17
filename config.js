let XplayerConfig =

// JSON
{
	"collection_title": 	"Humbuckers compare",

	"image_default": 	"assets/images/music-note-beamed_gray.svg",

	"image_filename_auto_ext": 	"jpg",

	"data_dir": 	"./data/humbuckers/",
	
	"dev": true,

	"crossfader_initial": -50,


	"tracks": [

				{
					"title": "Rhythm-drums 1",
					"filename": "_player-test-drum.mp3",
					"image_absolute": "assets/images/icon_drums.svg",

					"load_as": "backtrack"
				},
				{
					"title": "Flame / G&B - Bridge",
					"filename": "_player-test-guitar.mp3",
					"image": "flame-b.jpg",
					"description": "Lorem ipsum dolor sit amet...",

					"load_as": "A"
				},
				{
					"filename": "_player-test-guitar2.mp3",
					"title": "Flame / G&B - faked North",
					"image": "flame-n.jpg",

					"load_as": "B"
				}

	]
}