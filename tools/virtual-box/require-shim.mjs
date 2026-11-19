// The server of the box is one CommonJS bundle, and loads the API part of an extension with a plain require(). In development it runs
// as a module (tsx), where there is no require - so this file (loaded with --import by start.mjs) puts one in place.
import { createRequire } from 'node:module'

globalThis.require = createRequire(import.meta.url)
