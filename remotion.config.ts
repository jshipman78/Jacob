import { Config } from '@remotion/cli/config';

// Still-image / render output format and quality.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);

// This box has 4 cores — keep concurrency conservative so rendering doesn't
// starve the machine or thrash on image decoding for the large Ken Burns
// source stills.
Config.setConcurrency(3);

Config.setOverwriteOutput(true);

// This environment's egress policy blocks Remotion's Chrome download host, so
// point it at the Chromium that ships with the preinstalled Playwright.
const LOCAL_CHROMIUM =
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (require('fs').existsSync(LOCAL_CHROMIUM)) {
  Config.setBrowserExecutable(LOCAL_CHROMIUM);
}
