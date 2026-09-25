import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';

type Scene = {
  images: string[];
  duration_seconds: number;
  sfx_url?: string | null;
};

type ProcessRequest = {
  jobId: string;
  projectId?: string;
  userId?: string;
  scenes: Scene[];
};

const app = new Hono();

const PORT = Number(process.env.PORT || 8080);

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const INTERNAL_TOKEN = process.env.X_INKSPIRE_INTERNAL || '';

const RENDER_BUCKET = 'inkspire-videos';

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

if (!INTERNAL_TOKEN) {
  console.error('Missing X_INKSPIRE_INTERNAL');
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

function requireEnv() {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL is not configured');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  if (!INTERNAL_TOKEN) {
    throw new Error('X_INKSPIRE_INTERNAL is not configured');
  }
}

/**
 * Only HTTPS URLs are accepted.
 *
 * We also resolve the hostname and reject private/local IPs
 * to reduce SSRF risk.
 */
async function validateRemoteUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);

  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  if (url.username || url.password) {
    throw new Error('URLs containing credentials are not allowed');
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata.google'
  ) {
    throw new Error('Local/metadata hosts are not allowed');
  }

  const addresses = await dns.lookup(hostname, {
    all: true,
    verbatim: true
  });

  if (!addresses.length) {
    throw new Error('Unable to resolve remote host');
  }

  for (const address of addresses) {
    if (isPrivateIp(address.address)) {
      throw new Error('Private/internal IP addresses are not allowed');
    }
  }

  return url;
}

function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);

  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;

    return false;
  }

  if (family === 6) {
    const normalized = ip.toLowerCase();

    if (normalized === '::1') return true;
    if (normalized.startsWith('fc')) return true;
    if (normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8')) return true;
    if (normalized.startsWith('fe9')) return true;
    if (normalized.startsWith('fea')) return true;
    if (normalized.startsWith('feb')) return true;

    return false;
  }

  return true;
}

async function downloadFile(
  urlString: string,
  outputPath: string,
  maxBytes = 250 * 1024 * 1024
): Promise<void> {
  const url = await validateRemoteUrl(urlString);

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000)
  });

  if (!response.ok) {
    throw new Error(
      `Download failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const contentLength = response.headers.get('content-length');

  if (contentLength) {
    const size = Number(contentLength);

    if (Number.isFinite(size) && size > maxBytes) {
      throw new Error('Remote file is too large');
    }
  }

  if (!response.body) {
    throw new Error('Remote response has no body');
  }

  await pipeline(
    response.body as any,
    createWriteStream(outputPath)
  );

  const stat = await fs.stat(outputPath);

  if (stat.size > maxBytes) {
    await fs.unlink(outputPath).catch(() => {});
    throw new Error('Downloaded file is too large');
  }
}

function runFFmpeg(
  args: string[],
  cwd?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();

      if (stderr.length > 30_000) {
        stderr = stderr.slice(-30_000);
      }
    });

    child.on('error', (error) => {
      reject(
        new Error(`FFmpeg spawn failed: ${error.message}`)
      );
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `FFmpeg exited with code ${code}\n${stderr}`
        )
      );
    });
  });
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function createSceneVideo(
  sceneDir: string,
  scene: Scene,
  sceneIndex: number
): Promise<string> {
  const imageUrl = scene.images?.[0];

  if (!imageUrl) {
    throw new Error(
      `Scene ${sceneIndex}: no image URL provided`
    );
  }

  const duration = Math.min(
    Math.max(Number(scene.duration_seconds || 5), 1),
    300
  );

  const imagePath = path.join(
    sceneDir,
    `image-${sceneIndex}.img`
  );

  const audioPath = path.join(
    sceneDir,
    `sfx-${sceneIndex}.audio`
  );

  const outputPath = path.join(
    sceneDir,
    `scene-${sceneIndex}.mp4`
  );

  await downloadFile(imageUrl, imagePath);

  const hasSfx =
    typeof scene.sfx_url === 'string' &&
    scene.sfx_url.length > 0;

  if (hasSfx) {
    await downloadFile(
      scene.sfx_url!,
      audioPath,
      50 * 1024 * 1024
    );
  }

  /**
   * Every scene gets a video stream AND an audio stream.
   *
   * This is important because concat -c copy is reliable
   * only when all scene files have compatible stream layouts.
   */
  const audioInput = hasSfx
    ? audioPath
    : 'anullsrc=channel_layout=stereo:sample_rate=48000';

  const audioInputArgs = hasSfx
    ? ['-i', audioInput]
    : ['-f', 'lavfi', '-i', audioInput];

  const args = [
    '-y',

    '-loop',
    '1',
    '-i',
    imagePath,

    ...audioInputArgs,

    '-t',
    String(duration),

    '-vf',
    'scale=1280:720:force_original_aspect_ratio=decrease,' +
      'pad=1280:720:(ow-iw)/2:(oh-ih)/2',

    '-r',
    '30',

    '-c:v',
    'libx264',

    '-preset',
    'veryfast',

    '-pix_fmt',
    'yuv420p',

    '-c:a',
    'aac',

    '-ar',
    '48000',

    '-ac',
    '2',

    ...(hasSfx
      ? [
          '-af',
          'apad'
        ]
      : []),

    '-shortest',

    outputPath
  ];

  await runFFmpeg(args);

  return outputPath;
}

async function concatScenes(
  sceneFiles: string[],
  outputPath: string
): Promise<void> {
  const concatListPath = path.join(
    path.dirname(outputPath),
    'concat.txt'
  );

  const content = sceneFiles
    .map((file) => {
      const escaped = file
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\\''");

      return `file '${escaped}'`;
    })
    .join('\n');

  await fs.writeFile(
    concatListPath,
    `${content}\n`,
    'utf8'
  );

  await runFFmpeg([
    '-y',

    '-f',
    'concat',

    '-safe',
    '0',

    '-i',
    concatListPath,

    '-c',
    'copy',

    '-movflags',
    '+faststart',

    outputPath
  ]);
}

async function uploadRender(
  outputPath: string,
  jobId: string
): Promise<{
  storagePath: string;
  signedUrl: string | null;
}> {
  const fileBuffer = await fs.readFile(outputPath);

  const fileName =
    `${safeFileName(jobId)}-${crypto.randomUUID()}.mp4`;

  const storagePath = `renders/${fileName}`;

  const { error: uploadError } =
    await supabase.storage
      .from(RENDER_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false
      });

  if (uploadError) {
    throw new Error(
      `Supabase upload failed: ${uploadError.message}`
    );
  }

  /**
   * Bucket is private.
   * We return a temporary signed URL rather than
   * making the bucket public.
   */
  const { data: signedData, error: signedError } =
    await supabase.storage
      .from(RENDER_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (signedError) {
    throw new Error(
      `Signed URL creation failed: ${signedError.message}`
    );
  }

  return {
    storagePath,
    signedUrl: signedData?.signedUrl || null
  };
}

async function updateRenderJob(
  jobId: string,
  patch: {
    status?: string;
    progress?: number;
    output_url?: string | null;
    error_message?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('render_jobs')
    .update(patch)
    .eq('id', jobId);

  if (error) {
    console.warn(`[${jobId}] Failed to update render_jobs: ${error.message}`);
  }
}

async function processRender(
  request: ProcessRequest
) {
  requireEnv();

  if (!request.jobId) {
    throw new Error('jobId is required');
  }

  if (
    !Array.isArray(request.scenes) ||
    request.scenes.length === 0
  ) {
    throw new Error('At least one scene is required');
  }

  if (request.scenes.length > 100) {
    throw new Error('Too many scenes');
  }

  const tempRoot = await fs.mkdtemp(
    path.join(
      os.tmpdir(),
      'inkspire-render-'
    )
  );

  const sceneFiles: string[] = [];

  try {
    console.log(
      `[${request.jobId}] Render started`
    );

    await updateRenderJob(request.jobId, {
      status: 'processing',
      progress: 1,
      started_at: new Date().toISOString(),
      error_message: null
    });

    for (
      let index = 0;
      index < request.scenes.length;
      index++
    ) {
      const scene = request.scenes[index];

      const sceneDir = path.join(
        tempRoot,
        `scene-${index}`
      );

      await fs.mkdir(sceneDir, {
        recursive: true
      });

      console.log(
        `[${request.jobId}] Processing scene ${index + 1}/${request.scenes.length}`
      );

      const sceneVideo =
        await createSceneVideo(
          sceneDir,
          scene,
          index
        );

      sceneFiles.push(sceneVideo);

      const progress = Math.min(
        90,
        Math.round(((index + 1) / request.scenes.length) * 80) + 10
      );

      await updateRenderJob(request.jobId, {
        status: 'processing',
        progress
      });
    }

    const finalPath = path.join(
      tempRoot,
      'final.mp4'
    );

    console.log(
      `[${request.jobId}] Concatenating scenes`
    );

    await concatScenes(
      sceneFiles,
      finalPath
    );

    const stat = await fs.stat(finalPath);

    console.log(
      `[${request.jobId}] Uploading ${stat.size} bytes`
    );

    const upload =
      await uploadRender(
        finalPath,
        request.jobId
      );

    await updateRenderJob(request.jobId, {
      status: 'completed',
      progress: 100,
      output_url: upload.signedUrl,
      completed_at: new Date().toISOString(),
      error_message: null
    });

    if (request.projectId) {
      await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('id', request.projectId);
    }

    console.log(
      `[${request.jobId}] Render completed`
    );

    return {
      ok: true,
      jobId: request.jobId,
      projectId: request.projectId || null,
      storagePath: upload.storagePath,
      signedUrl: upload.signedUrl,
      fileSize: stat.size
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown render error';

    await updateRenderJob(request.jobId, {
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString()
    });

    if (request.projectId) {
      await supabase
        .from('projects')
        .update({ status: 'failed' })
        .eq('id', request.projectId);
    }

    throw error;
  } finally {
    await fs.rm(tempRoot, {
      recursive: true,
      force: true
    }).catch((error) => {
      console.warn(
        `[${request.jobId}] Cleanup failed:`,
        error
      );
    });

    console.log(
      `[${request.jobId}] Temporary files cleaned`
    );
  }
}

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'inkspire-render-worker',
    ffmpeg: 'available',
    timestamp: new Date().toISOString()
  });
});

app.post('/process', async (c) => {
  try {
    requireEnv();

    const token =
      c.req.header('x-inkspire-internal') || '';

    if (!token || token !== INTERNAL_TOKEN) {
      return c.json(
        {
          ok: false,
          error: 'Unauthorized'
        },
        401
      );
    }

    const body =
      await c.req.json<ProcessRequest>();

    if (!body.jobId) {
      return c.json(
        { ok: false, error: 'jobId is required' },
        400
      );
    }

    if (!Array.isArray(body.scenes) || body.scenes.length === 0) {
      return c.json(
        { ok: false, error: 'At least one scene is required' },
        400
      );
    }

    // Accept the job immediately. The actual FFmpeg render continues
    // in the Node process and updates render_jobs independently.
    void processRender(body).catch((error) => {
      console.error(
        `[${body.jobId}] Background render failed:`,
        error
      );
    });

    return c.json({
      ok: true,
      jobId: body.jobId,
      accepted: true
    }, 202);
  } catch (error) {
    console.error(
      'Render request failed:',
      error
    );

    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown render error'
      },
      500
    );
  }
});

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: 'Not found'
    },
    404
  );
});

app.onError((error, c) => {
  console.error(error);

  return c.json(
    {
      ok: false,
      error: 'Internal server error'
    },
    500
  );
});

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0'
});

console.log(
  `InkSpire Render Worker listening on 0.0.0.0:${PORT}`
);
