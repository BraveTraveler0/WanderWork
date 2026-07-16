const sharp = require('sharp')
const path = require('path')

const SRC = path.join(__dirname, 'icon-source.png')
const BG = '#F9FAFB'

async function main() {
  // Flat opaque icon for iOS + standalone Android icon (padded ~15% so the
  // mark doesn't get clipped by OS icon masking).
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
    .composite([{ input: await sharp(SRC).resize(760, 760, { fit: 'inside' }).toBuffer(), gravity: 'center' }])
    .flatten({ background: BG })
    .png()
    .toFile(path.join(__dirname, 'icon.png'))

  // Android adaptive icon background (solid) — same color as the flat icon.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
    .png()
    .toFile(path.join(__dirname, 'icon-background.png'))

  // Android adaptive icon foreground (transparent, mark sized down further
  // since adaptive icons crop ~30% off the edges depending on device mask).
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(SRC).resize(560, 560, { fit: 'inside' }).toBuffer(), gravity: 'center' }])
    .png()
    .toFile(path.join(__dirname, 'icon-foreground.png'))

  // Splash screen: same brand background, mark centered at moderate size.
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
    .composite([{ input: await sharp(SRC).resize(900, 900, { fit: 'inside' }).toBuffer(), gravity: 'center' }])
    .flatten({ background: BG })
    .png()
    .toFile(path.join(__dirname, 'splash.png'))

  console.log('icon.png, icon-background.png, icon-foreground.png, splash.png written')
}

main().catch((err) => { console.error(err); process.exit(1) })
