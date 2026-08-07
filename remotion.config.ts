import { Config } from '@remotion/cli/config';

// Still-image / render output format and quality.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);

// This box has 4 cores — keep concurrency conservative so rendering doesn't
// starve the machine or thrash on image decoding for the large Ken Burns
// source stills.
Config.setConcurrency(3);

Config.setOverwriteOutput(true);
