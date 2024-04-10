var ffmpeg = require('fluent-ffmpeg');

let newMp4 = ffmpeg();
newMp4
    .input("story_archive/Story_111/Chapter_1/1_2.png")
    .inputOption('-loop 1') // Loop the image
    .input('story_archive/Story_111/Chapter_1/1_2.mp3')
    .audioCodec('copy') // Use the audio codec from the source
    .outputOption('-shortest') // Finish encoding when the shortest input stream ends
    .outputFPS(30)
    .outputOptions([
        '-vf subtitles=story_archive/Story_111/Chapter_1/1_2.srt' // Add subtitles
    ])
    .save("story_archive/Story_111/Chapter_1/1_2_with_subtitles.mp4")
    .on('error', function(err) {
        console.log('Error: ' + err.message);
    })
    .on('end', function() {
        console.log('Finished processing');
    });
