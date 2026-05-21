/*const sharp = require('sharp');
async function processImage(inputImageBuffer, outputImagePath, width, height) {
  try {
    console.log('width',width);
    await sharp(inputImageBuffer)
    .sharpen()
    .resize({width:width, height:height,withoutEnlargement: true,})
      // .extract({ left: top, top: bottom, width: width, height: height })
      // .modulate({ brightness: 20, contrast: 20 })
      .toFile(outputImagePath);
      return true
  } catch (error) {
    console.error('process image error:', error);
    return false;
  }
}
async function processBacgroudImage(inputImageBuffer, outputImagePath,maxwidth,maxheight, width, height,topNumber,leftNumber) {
  try {
    await sharp(inputImageBuffer)
    .sharpen()
      .extract({ left: leftNumber, top: topNumber, width: width, height: height })
      .resize({width:maxwidth, height:maxheight,withoutEnlargement: true,})
      .toFile(outputImagePath);
      return true
  } catch (error) {
    console.error('process image error:', error);
    return false;
  }
}

module.exports = { processImage,processBacgroudImage };
*/


