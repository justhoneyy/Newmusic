import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import authGatePlugin from './vite-plugin-auth-gate.js';
import blobAssetPlugin from './vite-plugin-blob.js';
import svgUse from './vite-plugin-svg-use.js';
import uploadPlugin from './vite-plugin-upload.js';
import { playwright } from '@vitest/browser-playwright';
import { execSync } from 'child_process';

function proxyAudioPlugin() {
    return {
        name: 'proxy-audio-dev',
        configureServer(server) {
            // No longer needed: local proxy-audio middleware replaced by remote proxy
        },
    };
}

function getGitCommitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
}

export default defineConfig((_options) => {
    const commitHash = getGitCommitHash();

    return {
        test: {
            browser: {
                enabled: true,
                provider: playwright(),
                headless: !!process.env.HEADLESS,
                instances: [{ browser: 'chromium' }],
            },
        },

        base: './',

        define: {
            __COMMIT_HASH__: JSON.stringify(commitHash),
            __VITEST__: !!process.env.VITEST,
        },

        worker: {
            format: 'es',
        },

        resolve: {
            alias: {
                '!lucide': '/node_modules/lucide-static/icons',
                '!simpleicons': '/node_modules/simple-icons/icons',
                '!': '/node_modules',

                events: '/node_modules/events/events.js',
                pocketbase: '/node_modules/pocketbase/dist/pocketbase.es.js',
                stream: path.resolve(__dirname, 'stream-stub.js'),
            },
        },

        optimizeDeps: {
            exclude: ['pocketbase', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
        },

        server: {
            fs: {
                allow: ['.', 'node_modules'],
            },
        },

        build: {
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: false,
            minify: 'esbuild',
            cssCodeSplit: true,
            reportCompressedSize: false,
            chunkSizeWarningLimit: 1000,

            rollupOptions: {
                treeshake: true,

                output: {
                    manualChunks: (id) => {
                        if (id.includes('@ffmpeg')) {
                            return 'ffmpeg';
                        }

                        if (id.includes('butterchurn')) {
                            return 'visualizer';
                        }

                        if (
                            id.includes('hls.js') ||
                            id.includes('shaka-player')
                        ) {
                            return 'streaming';
                        }

                        if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                    },
                },
            },
        },

        plugins: [
            proxyAudioPlugin(),
            authGatePlugin(),
            uploadPlugin(),
            blobAssetPlugin(),
            svgUse(),

            VitePWA({
                registerType: 'prompt',

                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],

                    cleanupOutdatedCaches: true,

                    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

                    runtimeCaching: [
                        {
                            urlPattern: ({ request }) =>
                                request.destination === 'image',

                            handler: 'CacheFirst',

                            options: {
                                cacheName: 'images',

                                expiration: {
                                    maxEntries: 100,
                                    maxAgeSeconds: 60 * 24 * 60 * 60,
                                },
                            },
                        },

                        {
                            urlPattern: ({ request }) =>
                                request.destination === 'audio' ||
                                request.destination === 'video',

                            handler: 'CacheFirst',

                            options: {
                                cacheName: 'media',

                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 60 * 24 * 60 * 60,
                                },

                                rangeRequests: true,
                            },
                        },
                    ],
                },

                includeAssets: ['discord.html'],

                manifest: false,
            }),
        ],
    };
});
