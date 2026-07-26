/**
 * ESM shim: react-dom/server.browser has named exports only (no default).
 * Use the package export subpath (not .js) so Node/Vite resolve via "exports".
 */
import * as ReactDOMServer from "react-dom/server.browser";

export const version = ReactDOMServer.version;
export const renderToString = ReactDOMServer.renderToString;
export const renderToStaticMarkup = ReactDOMServer.renderToStaticMarkup;
export const renderToReadableStream = ReactDOMServer.renderToReadableStream;
export const resume = ReactDOMServer.resume;

export default ReactDOMServer;
