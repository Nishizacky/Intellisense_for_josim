/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@fast-csv/parse/build/src/CsvParserStream.js":
/*!*******************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/CsvParserStream.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CsvParserStream = void 0;
const string_decoder_1 = __webpack_require__(/*! string_decoder */ "string_decoder");
const stream_1 = __webpack_require__(/*! stream */ "stream");
const transforms_1 = __webpack_require__(/*! ./transforms */ "./node_modules/@fast-csv/parse/build/src/transforms/index.js");
const parser_1 = __webpack_require__(/*! ./parser */ "./node_modules/@fast-csv/parse/build/src/parser/index.js");
class CsvParserStream extends stream_1.Transform {
    parserOptions;
    decoder;
    parser;
    headerTransformer;
    rowTransformerValidator;
    lines = '';
    rowCount = 0;
    parsedRowCount = 0;
    parsedLineCount = 0;
    endEmitted = false;
    headersEmitted = false;
    constructor(parserOptions) {
        super({ objectMode: parserOptions.objectMode });
        this.parserOptions = parserOptions;
        this.parser = new parser_1.Parser(parserOptions);
        this.headerTransformer = new transforms_1.HeaderTransformer(parserOptions);
        this.decoder = new string_decoder_1.StringDecoder(parserOptions.encoding);
        this.rowTransformerValidator = new transforms_1.RowTransformerValidator();
    }
    get hasHitRowLimit() {
        return this.parserOptions.limitRows && this.rowCount >= this.parserOptions.maxRows;
    }
    get shouldEmitRows() {
        return this.parsedRowCount > this.parserOptions.skipRows;
    }
    get shouldSkipLine() {
        return this.parsedLineCount <= this.parserOptions.skipLines;
    }
    transform(transformFunction) {
        this.rowTransformerValidator.rowTransform = transformFunction;
        return this;
    }
    validate(validateFunction) {
        this.rowTransformerValidator.rowValidator = validateFunction;
        return this;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit(event, ...rest) {
        if (event === 'end') {
            if (!this.endEmitted) {
                this.endEmitted = true;
                super.emit('end', this.rowCount);
            }
            return false;
        }
        return super.emit(event, ...rest);
    }
    _transform(data, encoding, done) {
        // if we have hit our maxRows parsing limit then skip parsing
        if (this.hasHitRowLimit) {
            return done();
        }
        const wrappedCallback = CsvParserStream.wrapDoneCallback(done);
        try {
            const { lines } = this;
            const newLine = lines + this.decoder.write(data);
            const rows = this.parse(newLine, true);
            return this.processRows(rows, wrappedCallback);
        }
        catch (e) {
            return wrappedCallback(e);
        }
    }
    _flush(done) {
        const wrappedCallback = CsvParserStream.wrapDoneCallback(done);
        // if we have hit our maxRows parsing limit then skip parsing
        if (this.hasHitRowLimit) {
            return wrappedCallback();
        }
        try {
            const newLine = this.lines + this.decoder.end();
            const rows = this.parse(newLine, false);
            return this.processRows(rows, wrappedCallback);
        }
        catch (e) {
            return wrappedCallback(e);
        }
    }
    parse(data, hasMoreData) {
        if (!data) {
            return [];
        }
        const { line, rows } = this.parser.parse(data, hasMoreData);
        this.lines = line;
        return rows;
    }
    processRows(rows, cb) {
        const rowsLength = rows.length;
        const iterate = (i) => {
            const callNext = (err) => {
                if (err) {
                    return cb(err);
                }
                if (i % 100 === 0) {
                    // incase the transform are sync insert a next tick to prevent stack overflow
                    setImmediate(() => {
                        return iterate(i + 1);
                    });
                    return undefined;
                }
                return iterate(i + 1);
            };
            this.checkAndEmitHeaders();
            // if we have emitted all rows or we have hit the maxRows limit option
            // then end
            if (i >= rowsLength || this.hasHitRowLimit) {
                return cb();
            }
            this.parsedLineCount += 1;
            if (this.shouldSkipLine) {
                return callNext();
            }
            const row = rows[i];
            this.rowCount += 1;
            this.parsedRowCount += 1;
            const nextRowCount = this.rowCount;
            return this.transformRow(row, (err, transformResult) => {
                if (err) {
                    this.rowCount -= 1;
                    return callNext(err);
                }
                if (!transformResult) {
                    return callNext(new Error('expected transform result'));
                }
                if (!transformResult.isValid) {
                    this.emit('data-invalid', transformResult.row, nextRowCount, transformResult.reason);
                }
                else if (transformResult.row) {
                    return this.pushRow(transformResult.row, callNext);
                }
                return callNext();
            });
        };
        iterate(0);
    }
    transformRow(parsedRow, cb) {
        try {
            this.headerTransformer.transform(parsedRow, (err, withHeaders) => {
                if (err) {
                    return cb(err);
                }
                if (!withHeaders) {
                    return cb(new Error('Expected result from header transform'));
                }
                if (!withHeaders.isValid) {
                    if (this.shouldEmitRows) {
                        return cb(null, { isValid: false, row: parsedRow });
                    }
                    // skipped because of skipRows option remove from total row count
                    return this.skipRow(cb);
                }
                if (withHeaders.row) {
                    if (this.shouldEmitRows) {
                        return this.rowTransformerValidator.transformAndValidate(withHeaders.row, cb);
                    }
                    // skipped because of skipRows option remove from total row count
                    return this.skipRow(cb);
                }
                // this is a header row dont include in the rowCount or parsedRowCount
                this.rowCount -= 1;
                this.parsedRowCount -= 1;
                return cb(null, { row: null, isValid: true });
            });
        }
        catch (e) {
            cb(e);
        }
    }
    checkAndEmitHeaders() {
        if (!this.headersEmitted && this.headerTransformer.headers) {
            this.headersEmitted = true;
            this.emit('headers', this.headerTransformer.headers);
        }
    }
    skipRow(cb) {
        // skipped because of skipRows option remove from total row count
        this.rowCount -= 1;
        return cb(null, { row: null, isValid: true });
    }
    pushRow(row, cb) {
        try {
            if (!this.parserOptions.objectMode) {
                this.push(JSON.stringify(row));
            }
            else {
                this.push(row);
            }
            cb();
        }
        catch (e) {
            cb(e);
        }
    }
    static wrapDoneCallback(done) {
        let errorCalled = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (err, ...args) => {
            if (err) {
                if (errorCalled) {
                    throw err;
                }
                errorCalled = true;
                done(err);
                return;
            }
            done(...args);
        };
    }
}
exports.CsvParserStream = CsvParserStream;
//# sourceMappingURL=CsvParserStream.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/ParserOptions.js":
/*!*****************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/ParserOptions.js ***!
  \*****************************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ParserOptions = void 0;
const lodash_escaperegexp_1 = __importDefault(__webpack_require__(/*! lodash.escaperegexp */ "./node_modules/lodash.escaperegexp/index.js"));
const lodash_isnil_1 = __importDefault(__webpack_require__(/*! lodash.isnil */ "./node_modules/lodash.isnil/index.js"));
class ParserOptions {
    escapedDelimiter;
    objectMode = true;
    delimiter = ',';
    ignoreEmpty = false;
    quote = '"';
    escape = null;
    escapeChar = this.quote;
    comment = null;
    supportsComments = false;
    ltrim = false;
    rtrim = false;
    trim = false;
    headers = null;
    renameHeaders = false;
    strictColumnHandling = false;
    discardUnmappedColumns = false;
    carriageReturn = '\r';
    NEXT_TOKEN_REGEXP;
    encoding = 'utf8';
    limitRows = false;
    maxRows = 0;
    skipLines = 0;
    skipRows = 0;
    constructor(opts) {
        Object.assign(this, opts || {});
        if (this.delimiter.length > 1) {
            throw new Error('delimiter option must be one character long');
        }
        this.escapedDelimiter = (0, lodash_escaperegexp_1.default)(this.delimiter);
        this.escapeChar = this.escape ?? this.quote;
        this.supportsComments = !(0, lodash_isnil_1.default)(this.comment);
        this.NEXT_TOKEN_REGEXP = new RegExp(`([^\\s]|\\r\\n|\\n|\\r|${this.escapedDelimiter})`);
        if (this.maxRows > 0) {
            this.limitRows = true;
        }
    }
}
exports.ParserOptions = ParserOptions;
//# sourceMappingURL=ParserOptions.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/index.js":
/*!*********************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/index.js ***!
  \*********************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseString = exports.parseFile = exports.parseStream = exports.parse = exports.ParserOptions = exports.CsvParserStream = void 0;
const fs = __importStar(__webpack_require__(/*! fs */ "fs"));
const stream_1 = __webpack_require__(/*! stream */ "stream");
const ParserOptions_1 = __webpack_require__(/*! ./ParserOptions */ "./node_modules/@fast-csv/parse/build/src/ParserOptions.js");
const CsvParserStream_1 = __webpack_require__(/*! ./CsvParserStream */ "./node_modules/@fast-csv/parse/build/src/CsvParserStream.js");
__exportStar(__webpack_require__(/*! ./types */ "./node_modules/@fast-csv/parse/build/src/types.js"), exports);
var CsvParserStream_2 = __webpack_require__(/*! ./CsvParserStream */ "./node_modules/@fast-csv/parse/build/src/CsvParserStream.js");
Object.defineProperty(exports, "CsvParserStream", ({ enumerable: true, get: function () { return CsvParserStream_2.CsvParserStream; } }));
var ParserOptions_2 = __webpack_require__(/*! ./ParserOptions */ "./node_modules/@fast-csv/parse/build/src/ParserOptions.js");
Object.defineProperty(exports, "ParserOptions", ({ enumerable: true, get: function () { return ParserOptions_2.ParserOptions; } }));
const parse = (args) => {
    return new CsvParserStream_1.CsvParserStream(new ParserOptions_1.ParserOptions(args));
};
exports.parse = parse;
const parseStream = (stream, options) => {
    return stream.pipe(new CsvParserStream_1.CsvParserStream(new ParserOptions_1.ParserOptions(options)));
};
exports.parseStream = parseStream;
const parseFile = (location, options = {}) => {
    return fs.createReadStream(location).pipe(new CsvParserStream_1.CsvParserStream(new ParserOptions_1.ParserOptions(options)));
};
exports.parseFile = parseFile;
const parseString = (string, options) => {
    const rs = new stream_1.Readable();
    rs.push(string);
    rs.push(null);
    return rs.pipe(new CsvParserStream_1.CsvParserStream(new ParserOptions_1.ParserOptions(options)));
};
exports.parseString = parseString;
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/Parser.js":
/*!*****************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/Parser.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Parser = void 0;
const Scanner_1 = __webpack_require__(/*! ./Scanner */ "./node_modules/@fast-csv/parse/build/src/parser/Scanner.js");
const RowParser_1 = __webpack_require__(/*! ./RowParser */ "./node_modules/@fast-csv/parse/build/src/parser/RowParser.js");
const Token_1 = __webpack_require__(/*! ./Token */ "./node_modules/@fast-csv/parse/build/src/parser/Token.js");
class Parser {
    static removeBOM(line) {
        // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
        // conversion translates it to FEFF (UTF-16 BOM)
        if (line && line.charCodeAt(0) === 0xfeff) {
            return line.slice(1);
        }
        return line;
    }
    parserOptions;
    rowParser;
    constructor(parserOptions) {
        this.parserOptions = parserOptions;
        this.rowParser = new RowParser_1.RowParser(this.parserOptions);
    }
    parse(line, hasMoreData) {
        const scanner = new Scanner_1.Scanner({
            line: Parser.removeBOM(line),
            parserOptions: this.parserOptions,
            hasMoreData,
        });
        if (this.parserOptions.supportsComments) {
            return this.parseWithComments(scanner);
        }
        return this.parseWithoutComments(scanner);
    }
    parseWithoutComments(scanner) {
        const rows = [];
        let shouldContinue = true;
        while (shouldContinue) {
            shouldContinue = this.parseRow(scanner, rows);
        }
        return { line: scanner.line, rows };
    }
    parseWithComments(scanner) {
        const { parserOptions } = this;
        const rows = [];
        for (let nextToken = scanner.nextCharacterToken; nextToken !== null; nextToken = scanner.nextCharacterToken) {
            if (Token_1.Token.isTokenComment(nextToken, parserOptions)) {
                const cursor = scanner.advancePastLine();
                if (cursor === null) {
                    return { line: scanner.lineFromCursor, rows };
                }
                if (!scanner.hasMoreCharacters) {
                    return { line: scanner.lineFromCursor, rows };
                }
                scanner.truncateToCursor();
            }
            else if (!this.parseRow(scanner, rows)) {
                break;
            }
        }
        return { line: scanner.line, rows };
    }
    parseRow(scanner, rows) {
        const nextToken = scanner.nextNonSpaceToken;
        if (!nextToken) {
            return false;
        }
        const row = this.rowParser.parse(scanner);
        if (row === null) {
            return false;
        }
        if (this.parserOptions.ignoreEmpty && RowParser_1.RowParser.isEmptyRow(row)) {
            return true;
        }
        rows.push(row);
        return true;
    }
}
exports.Parser = Parser;
//# sourceMappingURL=Parser.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/RowParser.js":
/*!********************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/RowParser.js ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RowParser = void 0;
const column_1 = __webpack_require__(/*! ./column */ "./node_modules/@fast-csv/parse/build/src/parser/column/index.js");
const Token_1 = __webpack_require__(/*! ./Token */ "./node_modules/@fast-csv/parse/build/src/parser/Token.js");
const EMPTY_STRING = '';
class RowParser {
    static isEmptyRow(row) {
        return row.join(EMPTY_STRING).replace(/\s+/g, EMPTY_STRING) === EMPTY_STRING;
    }
    parserOptions;
    columnParser;
    constructor(parserOptions) {
        this.parserOptions = parserOptions;
        this.columnParser = new column_1.ColumnParser(parserOptions);
    }
    parse(scanner) {
        const { parserOptions } = this;
        const { hasMoreData } = scanner;
        const currentScanner = scanner;
        const columns = [];
        let currentToken = this.getStartToken(currentScanner, columns);
        while (currentToken) {
            if (Token_1.Token.isTokenRowDelimiter(currentToken)) {
                currentScanner.advancePastToken(currentToken);
                // if ends with CR and there is more data, keep unparsed due to possible
                // coming LF in CRLF
                if (!currentScanner.hasMoreCharacters &&
                    Token_1.Token.isTokenCarriageReturn(currentToken, parserOptions) &&
                    hasMoreData) {
                    return null;
                }
                currentScanner.truncateToCursor();
                return columns;
            }
            if (!this.shouldSkipColumnParse(currentScanner, currentToken, columns)) {
                const item = this.columnParser.parse(currentScanner);
                if (item === null) {
                    return null;
                }
                columns.push(item);
            }
            currentToken = currentScanner.nextNonSpaceToken;
        }
        if (!hasMoreData) {
            currentScanner.truncateToCursor();
            return columns;
        }
        return null;
    }
    getStartToken(scanner, columns) {
        const currentToken = scanner.nextNonSpaceToken;
        if (currentToken !== null && Token_1.Token.isTokenDelimiter(currentToken, this.parserOptions)) {
            columns.push('');
            return scanner.nextNonSpaceToken;
        }
        return currentToken;
    }
    shouldSkipColumnParse(scanner, currentToken, columns) {
        const { parserOptions } = this;
        if (Token_1.Token.isTokenDelimiter(currentToken, parserOptions)) {
            scanner.advancePastToken(currentToken);
            // if the delimiter is at the end of a line
            const nextToken = scanner.nextCharacterToken;
            if (!scanner.hasMoreCharacters || (nextToken !== null && Token_1.Token.isTokenRowDelimiter(nextToken))) {
                columns.push('');
                return true;
            }
            if (nextToken !== null && Token_1.Token.isTokenDelimiter(nextToken, parserOptions)) {
                columns.push('');
                return true;
            }
        }
        return false;
    }
}
exports.RowParser = RowParser;
//# sourceMappingURL=RowParser.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/Scanner.js":
/*!******************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/Scanner.js ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Scanner = void 0;
const Token_1 = __webpack_require__(/*! ./Token */ "./node_modules/@fast-csv/parse/build/src/parser/Token.js");
const ROW_DELIMITER = /((?:\r\n)|\n|\r)/;
class Scanner {
    line;
    parserOptions;
    lineLength;
    hasMoreData;
    cursor = 0;
    constructor(args) {
        this.line = args.line;
        this.lineLength = this.line.length;
        this.parserOptions = args.parserOptions;
        this.hasMoreData = args.hasMoreData;
        this.cursor = args.cursor || 0;
    }
    get hasMoreCharacters() {
        return this.lineLength > this.cursor;
    }
    get nextNonSpaceToken() {
        const { lineFromCursor } = this;
        const regex = this.parserOptions.NEXT_TOKEN_REGEXP;
        if (lineFromCursor.search(regex) === -1) {
            return null;
        }
        const match = regex.exec(lineFromCursor);
        if (match == null) {
            return null;
        }
        const token = match[1];
        const startCursor = this.cursor + (match.index || 0);
        return new Token_1.Token({
            token,
            startCursor,
            endCursor: startCursor + token.length - 1,
        });
    }
    get nextCharacterToken() {
        const { cursor, lineLength } = this;
        if (lineLength <= cursor) {
            return null;
        }
        return new Token_1.Token({
            token: this.line[cursor],
            startCursor: cursor,
            endCursor: cursor,
        });
    }
    get lineFromCursor() {
        return this.line.substr(this.cursor);
    }
    advancePastLine() {
        const match = ROW_DELIMITER.exec(this.lineFromCursor);
        if (!match) {
            if (this.hasMoreData) {
                return null;
            }
            this.cursor = this.lineLength;
            return this;
        }
        this.cursor += (match.index || 0) + match[0].length;
        return this;
    }
    advanceTo(cursor) {
        this.cursor = cursor;
        return this;
    }
    advanceToToken(token) {
        this.cursor = token.startCursor;
        return this;
    }
    advancePastToken(token) {
        this.cursor = token.endCursor + 1;
        return this;
    }
    truncateToCursor() {
        this.line = this.lineFromCursor;
        this.lineLength = this.line.length;
        this.cursor = 0;
        return this;
    }
}
exports.Scanner = Scanner;
//# sourceMappingURL=Scanner.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/Token.js":
/*!****************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/Token.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Token = void 0;
class Token {
    static isTokenRowDelimiter(token) {
        const content = token.token;
        return content === '\r' || content === '\n' || content === '\r\n';
    }
    static isTokenCarriageReturn(token, parserOptions) {
        return token.token === parserOptions.carriageReturn;
    }
    static isTokenComment(token, parserOptions) {
        return parserOptions.supportsComments && !!token && token.token === parserOptions.comment;
    }
    static isTokenEscapeCharacter(token, parserOptions) {
        return token.token === parserOptions.escapeChar;
    }
    static isTokenQuote(token, parserOptions) {
        return token.token === parserOptions.quote;
    }
    static isTokenDelimiter(token, parserOptions) {
        return token.token === parserOptions.delimiter;
    }
    token;
    startCursor;
    endCursor;
    constructor(tokenArgs) {
        this.token = tokenArgs.token;
        this.startCursor = tokenArgs.startCursor;
        this.endCursor = tokenArgs.endCursor;
    }
}
exports.Token = Token;
//# sourceMappingURL=Token.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/column/ColumnFormatter.js":
/*!*********************************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/column/ColumnFormatter.js ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ColumnFormatter = void 0;
class ColumnFormatter {
    format;
    constructor(parserOptions) {
        if (parserOptions.trim) {
            this.format = (col) => {
                return col.trim();
            };
        }
        else if (parserOptions.ltrim) {
            this.format = (col) => {
                return col.trimLeft();
            };
        }
        else if (parserOptions.rtrim) {
            this.format = (col) => {
                return col.trimRight();
            };
        }
        else {
            this.format = (col) => {
                return col;
            };
        }
    }
}
exports.ColumnFormatter = ColumnFormatter;
//# sourceMappingURL=ColumnFormatter.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/column/ColumnParser.js":
/*!******************************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/column/ColumnParser.js ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ColumnParser = void 0;
const NonQuotedColumnParser_1 = __webpack_require__(/*! ./NonQuotedColumnParser */ "./node_modules/@fast-csv/parse/build/src/parser/column/NonQuotedColumnParser.js");
const QuotedColumnParser_1 = __webpack_require__(/*! ./QuotedColumnParser */ "./node_modules/@fast-csv/parse/build/src/parser/column/QuotedColumnParser.js");
const Token_1 = __webpack_require__(/*! ../Token */ "./node_modules/@fast-csv/parse/build/src/parser/Token.js");
class ColumnParser {
    parserOptions;
    nonQuotedColumnParser;
    quotedColumnParser;
    constructor(parserOptions) {
        this.parserOptions = parserOptions;
        this.quotedColumnParser = new QuotedColumnParser_1.QuotedColumnParser(parserOptions);
        this.nonQuotedColumnParser = new NonQuotedColumnParser_1.NonQuotedColumnParser(parserOptions);
    }
    parse(scanner) {
        const { nextNonSpaceToken } = scanner;
        if (nextNonSpaceToken !== null && Token_1.Token.isTokenQuote(nextNonSpaceToken, this.parserOptions)) {
            scanner.advanceToToken(nextNonSpaceToken);
            return this.quotedColumnParser.parse(scanner);
        }
        return this.nonQuotedColumnParser.parse(scanner);
    }
}
exports.ColumnParser = ColumnParser;
//# sourceMappingURL=ColumnParser.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/column/NonQuotedColumnParser.js":
/*!***************************************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/column/NonQuotedColumnParser.js ***!
  \***************************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NonQuotedColumnParser = void 0;
const ColumnFormatter_1 = __webpack_require__(/*! ./ColumnFormatter */ "./node_modules/@fast-csv/parse/build/src/parser/column/ColumnFormatter.js");
const Token_1 = __webpack_require__(/*! ../Token */ "./node_modules/@fast-csv/parse/build/src/parser/Token.js");
class NonQuotedColumnParser {
    parserOptions;
    columnFormatter;
    constructor(parserOptions) {
        this.parserOptions = parserOptions;
        this.columnFormatter = new ColumnFormatter_1.ColumnFormatter(parserOptions);
    }
    parse(scanner) {
        if (!scanner.hasMoreCharacters) {
            return null;
        }
        const { parserOptions } = this;
        const characters = [];
        let nextToken = scanner.nextCharacterToken;
        for (; nextToken; nextToken = scanner.nextCharacterToken) {
            if (Token_1.Token.isTokenDelimiter(nextToken, parserOptions) || Token_1.Token.isTokenRowDelimiter(nextToken)) {
                break;
            }
            characters.push(nextToken.token);
            scanner.advancePastToken(nextToken);
        }
        return this.columnFormatter.format(characters.join(''));
    }
}
exports.NonQuotedColumnParser = NonQuotedColumnParser;
//# sourceMappingURL=NonQuotedColumnParser.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/column/QuotedColumnParser.js":
/*!************************************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/column/QuotedColumnParser.js ***!
  \************************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QuotedColumnParser = void 0;
const ColumnFormatter_1 = __webpack_require__(/*! ./ColumnFormatter */ "./node_modules/@fast-csv/parse/build/src/parser/column/ColumnFormatter.js");
const Token_1 = __webpack_require__(/*! ../Token */ "./node_modules/@fast-csv/parse/build/src/parser/Token.js");
class QuotedColumnParser {
    parserOptions;
    columnFormatter;
    constructor(parserOptions) {
        this.parserOptions = parserOptions;
        this.columnFormatter = new ColumnFormatter_1.ColumnFormatter(parserOptions);
    }
    parse(scanner) {
        if (!scanner.hasMoreCharacters) {
            return null;
        }
        const originalCursor = scanner.cursor;
        const { foundClosingQuote, col } = this.gatherDataBetweenQuotes(scanner);
        if (!foundClosingQuote) {
            // reset the cursor to the original
            scanner.advanceTo(originalCursor);
            // if we didnt find a closing quote but we potentially have more data then skip the parsing
            // and return the original scanner.
            if (!scanner.hasMoreData) {
                throw new Error(`Parse Error: missing closing: '${this.parserOptions.quote || ''}' in line: at '${scanner.lineFromCursor.replace(/[\r\n]/g, "\\n'")}'`);
            }
            return null;
        }
        this.checkForMalformedColumn(scanner);
        return col;
    }
    gatherDataBetweenQuotes(scanner) {
        const { parserOptions } = this;
        let foundStartingQuote = false;
        let foundClosingQuote = false;
        const characters = [];
        let nextToken = scanner.nextCharacterToken;
        for (; !foundClosingQuote && nextToken !== null; nextToken = scanner.nextCharacterToken) {
            const isQuote = Token_1.Token.isTokenQuote(nextToken, parserOptions);
            // ignore first quote
            if (!foundStartingQuote && isQuote) {
                foundStartingQuote = true;
            }
            else if (foundStartingQuote) {
                if (Token_1.Token.isTokenEscapeCharacter(nextToken, parserOptions)) {
                    // advance past the escape character so we can get the next one in line
                    scanner.advancePastToken(nextToken);
                    const tokenFollowingEscape = scanner.nextCharacterToken;
                    // if the character following the escape is a quote character then just add
                    // the quote and advance to that character
                    if (tokenFollowingEscape !== null &&
                        (Token_1.Token.isTokenQuote(tokenFollowingEscape, parserOptions) ||
                            Token_1.Token.isTokenEscapeCharacter(tokenFollowingEscape, parserOptions))) {
                        characters.push(tokenFollowingEscape.token);
                        nextToken = tokenFollowingEscape;
                    }
                    else if (isQuote) {
                        // if the escape is also a quote then we found our closing quote and finish early
                        foundClosingQuote = true;
                    }
                    else {
                        // other wise add the escape token to the characters since it wast escaping anything
                        characters.push(nextToken.token);
                    }
                }
                else if (isQuote) {
                    // we found our closing quote!
                    foundClosingQuote = true;
                }
                else {
                    // add the token to the characters
                    characters.push(nextToken.token);
                }
            }
            scanner.advancePastToken(nextToken);
        }
        return { col: this.columnFormatter.format(characters.join('')), foundClosingQuote };
    }
    checkForMalformedColumn(scanner) {
        const { parserOptions } = this;
        const { nextNonSpaceToken } = scanner;
        if (nextNonSpaceToken) {
            const isNextTokenADelimiter = Token_1.Token.isTokenDelimiter(nextNonSpaceToken, parserOptions);
            const isNextTokenARowDelimiter = Token_1.Token.isTokenRowDelimiter(nextNonSpaceToken);
            if (!(isNextTokenADelimiter || isNextTokenARowDelimiter)) {
                // if the final quote was NOT followed by a column (,) or row(\n) delimiter then its a bad column
                // tldr: only part of the column was quoted
                const linePreview = scanner.lineFromCursor.substr(0, 10).replace(/[\r\n]/g, "\\n'");
                throw new Error(`Parse Error: expected: '${parserOptions.escapedDelimiter}' OR new line got: '${nextNonSpaceToken.token}'. at '${linePreview}'`);
            }
            scanner.advanceToToken(nextNonSpaceToken);
        }
        else if (!scanner.hasMoreData) {
            scanner.advancePastLine();
        }
    }
}
exports.QuotedColumnParser = QuotedColumnParser;
//# sourceMappingURL=QuotedColumnParser.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/column/index.js":
/*!***********************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/column/index.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ColumnFormatter = exports.QuotedColumnParser = exports.NonQuotedColumnParser = exports.ColumnParser = void 0;
var ColumnParser_1 = __webpack_require__(/*! ./ColumnParser */ "./node_modules/@fast-csv/parse/build/src/parser/column/ColumnParser.js");
Object.defineProperty(exports, "ColumnParser", ({ enumerable: true, get: function () { return ColumnParser_1.ColumnParser; } }));
var NonQuotedColumnParser_1 = __webpack_require__(/*! ./NonQuotedColumnParser */ "./node_modules/@fast-csv/parse/build/src/parser/column/NonQuotedColumnParser.js");
Object.defineProperty(exports, "NonQuotedColumnParser", ({ enumerable: true, get: function () { return NonQuotedColumnParser_1.NonQuotedColumnParser; } }));
var QuotedColumnParser_1 = __webpack_require__(/*! ./QuotedColumnParser */ "./node_modules/@fast-csv/parse/build/src/parser/column/QuotedColumnParser.js");
Object.defineProperty(exports, "QuotedColumnParser", ({ enumerable: true, get: function () { return QuotedColumnParser_1.QuotedColumnParser; } }));
var ColumnFormatter_1 = __webpack_require__(/*! ./ColumnFormatter */ "./node_modules/@fast-csv/parse/build/src/parser/column/ColumnFormatter.js");
Object.defineProperty(exports, "ColumnFormatter", ({ enumerable: true, get: function () { return ColumnFormatter_1.ColumnFormatter; } }));
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/parser/index.js":
/*!****************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/parser/index.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QuotedColumnParser = exports.NonQuotedColumnParser = exports.ColumnParser = exports.Token = exports.Scanner = exports.RowParser = exports.Parser = void 0;
var Parser_1 = __webpack_require__(/*! ./Parser */ "./node_modules/@fast-csv/parse/build/src/parser/Parser.js");
Object.defineProperty(exports, "Parser", ({ enumerable: true, get: function () { return Parser_1.Parser; } }));
var RowParser_1 = __webpack_require__(/*! ./RowParser */ "./node_modules/@fast-csv/parse/build/src/parser/RowParser.js");
Object.defineProperty(exports, "RowParser", ({ enumerable: true, get: function () { return RowParser_1.RowParser; } }));
var Scanner_1 = __webpack_require__(/*! ./Scanner */ "./node_modules/@fast-csv/parse/build/src/parser/Scanner.js");
Object.defineProperty(exports, "Scanner", ({ enumerable: true, get: function () { return Scanner_1.Scanner; } }));
var Token_1 = __webpack_require__(/*! ./Token */ "./node_modules/@fast-csv/parse/build/src/parser/Token.js");
Object.defineProperty(exports, "Token", ({ enumerable: true, get: function () { return Token_1.Token; } }));
var column_1 = __webpack_require__(/*! ./column */ "./node_modules/@fast-csv/parse/build/src/parser/column/index.js");
Object.defineProperty(exports, "ColumnParser", ({ enumerable: true, get: function () { return column_1.ColumnParser; } }));
Object.defineProperty(exports, "NonQuotedColumnParser", ({ enumerable: true, get: function () { return column_1.NonQuotedColumnParser; } }));
Object.defineProperty(exports, "QuotedColumnParser", ({ enumerable: true, get: function () { return column_1.QuotedColumnParser; } }));
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/transforms/HeaderTransformer.js":
/*!********************************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/transforms/HeaderTransformer.js ***!
  \********************************************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HeaderTransformer = void 0;
const lodash_isundefined_1 = __importDefault(__webpack_require__(/*! lodash.isundefined */ "./node_modules/lodash.isundefined/index.js"));
const lodash_isfunction_1 = __importDefault(__webpack_require__(/*! lodash.isfunction */ "./node_modules/lodash.isfunction/index.js"));
const lodash_uniq_1 = __importDefault(__webpack_require__(/*! lodash.uniq */ "./node_modules/lodash.uniq/index.js"));
const lodash_groupby_1 = __importDefault(__webpack_require__(/*! lodash.groupby */ "./node_modules/lodash.groupby/index.js"));
class HeaderTransformer {
    parserOptions;
    headers = null;
    receivedHeaders = false;
    shouldUseFirstRow = false;
    processedFirstRow = false;
    headersLength = 0;
    headersTransform;
    constructor(parserOptions) {
        this.parserOptions = parserOptions;
        if (parserOptions.headers === true) {
            this.shouldUseFirstRow = true;
        }
        else if (Array.isArray(parserOptions.headers)) {
            this.setHeaders(parserOptions.headers);
        }
        else if ((0, lodash_isfunction_1.default)(parserOptions.headers)) {
            this.headersTransform = parserOptions.headers;
        }
    }
    transform(row, cb) {
        if (!this.shouldMapRow(row)) {
            return cb(null, { row: null, isValid: true });
        }
        return cb(null, this.processRow(row));
    }
    shouldMapRow(row) {
        const { parserOptions } = this;
        if (!this.headersTransform && parserOptions.renameHeaders && !this.processedFirstRow) {
            if (!this.receivedHeaders) {
                throw new Error('Error renaming headers: new headers must be provided in an array');
            }
            this.processedFirstRow = true;
            return false;
        }
        if (!this.receivedHeaders && Array.isArray(row)) {
            if (this.headersTransform) {
                this.setHeaders(this.headersTransform(row));
            }
            else if (this.shouldUseFirstRow) {
                this.setHeaders(row);
            }
            else {
                // dont do anything with the headers if we didnt receive a transform or shouldnt use the first row.
                return true;
            }
            return false;
        }
        return true;
    }
    processRow(row) {
        if (!this.headers) {
            return { row: row, isValid: true };
        }
        const { parserOptions } = this;
        if (!parserOptions.discardUnmappedColumns && row.length > this.headersLength) {
            if (!parserOptions.strictColumnHandling) {
                throw new Error(`Unexpected Error: column header mismatch expected: ${this.headersLength} columns got: ${row.length}`);
            }
            return {
                row: row,
                isValid: false,
                reason: `Column header mismatch expected: ${this.headersLength} columns got: ${row.length}`,
            };
        }
        if (parserOptions.strictColumnHandling && row.length < this.headersLength) {
            return {
                row: row,
                isValid: false,
                reason: `Column header mismatch expected: ${this.headersLength} columns got: ${row.length}`,
            };
        }
        return { row: this.mapHeaders(row), isValid: true };
    }
    mapHeaders(row) {
        const rowMap = {};
        const { headers, headersLength } = this;
        for (let i = 0; i < headersLength; i += 1) {
            const header = headers[i];
            if (!(0, lodash_isundefined_1.default)(header)) {
                const val = row[i];
                // eslint-disable-next-line no-param-reassign
                if ((0, lodash_isundefined_1.default)(val)) {
                    rowMap[header] = '';
                }
                else {
                    rowMap[header] = val;
                }
            }
        }
        return rowMap;
    }
    setHeaders(headers) {
        const filteredHeaders = headers.filter((h) => {
            return !!h;
        });
        if ((0, lodash_uniq_1.default)(filteredHeaders).length !== filteredHeaders.length) {
            const grouped = (0, lodash_groupby_1.default)(filteredHeaders);
            const duplicates = Object.keys(grouped).filter((dup) => {
                return grouped[dup].length > 1;
            });
            throw new Error(`Duplicate headers found ${JSON.stringify(duplicates)}`);
        }
        this.headers = headers;
        this.receivedHeaders = true;
        this.headersLength = this.headers?.length || 0;
    }
}
exports.HeaderTransformer = HeaderTransformer;
//# sourceMappingURL=HeaderTransformer.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/transforms/RowTransformerValidator.js":
/*!**************************************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/transforms/RowTransformerValidator.js ***!
  \**************************************************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RowTransformerValidator = void 0;
const lodash_isfunction_1 = __importDefault(__webpack_require__(/*! lodash.isfunction */ "./node_modules/lodash.isfunction/index.js"));
const types_1 = __webpack_require__(/*! ../types */ "./node_modules/@fast-csv/parse/build/src/types.js");
class RowTransformerValidator {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    static createTransform(transformFunction) {
        if ((0, types_1.isSyncTransform)(transformFunction)) {
            return (row, cb) => {
                let transformed = null;
                try {
                    transformed = transformFunction(row);
                }
                catch (e) {
                    return cb(e);
                }
                return cb(null, transformed);
            };
        }
        return transformFunction;
    }
    static createValidator(validateFunction) {
        if ((0, types_1.isSyncValidate)(validateFunction)) {
            return (row, cb) => {
                cb(null, { row, isValid: validateFunction(row) });
            };
        }
        return (row, cb) => {
            validateFunction(row, (err, isValid, reason) => {
                if (err) {
                    return cb(err);
                }
                if (isValid) {
                    return cb(null, { row, isValid, reason });
                }
                return cb(null, { row, isValid: false, reason });
            });
        };
    }
    _rowTransform = null;
    _rowValidator = null;
    set rowTransform(transformFunction) {
        if (!(0, lodash_isfunction_1.default)(transformFunction)) {
            throw new TypeError('The transform should be a function');
        }
        this._rowTransform = RowTransformerValidator.createTransform(transformFunction);
    }
    set rowValidator(validateFunction) {
        if (!(0, lodash_isfunction_1.default)(validateFunction)) {
            throw new TypeError('The validate should be a function');
        }
        this._rowValidator = RowTransformerValidator.createValidator(validateFunction);
    }
    transformAndValidate(row, cb) {
        return this.callTransformer(row, (transformErr, transformedRow) => {
            if (transformErr) {
                return cb(transformErr);
            }
            if (!transformedRow) {
                return cb(null, { row: null, isValid: true });
            }
            return this.callValidator(transformedRow, (validateErr, validationResult) => {
                if (validateErr) {
                    return cb(validateErr);
                }
                if (validationResult && !validationResult.isValid) {
                    return cb(null, { row: transformedRow, isValid: false, reason: validationResult.reason });
                }
                return cb(null, { row: transformedRow, isValid: true });
            });
        });
    }
    callTransformer(row, cb) {
        if (!this._rowTransform) {
            return cb(null, row);
        }
        return this._rowTransform(row, cb);
    }
    callValidator(row, cb) {
        if (!this._rowValidator) {
            return cb(null, { row, isValid: true });
        }
        return this._rowValidator(row, cb);
    }
}
exports.RowTransformerValidator = RowTransformerValidator;
//# sourceMappingURL=RowTransformerValidator.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/transforms/index.js":
/*!********************************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/transforms/index.js ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HeaderTransformer = exports.RowTransformerValidator = void 0;
var RowTransformerValidator_1 = __webpack_require__(/*! ./RowTransformerValidator */ "./node_modules/@fast-csv/parse/build/src/transforms/RowTransformerValidator.js");
Object.defineProperty(exports, "RowTransformerValidator", ({ enumerable: true, get: function () { return RowTransformerValidator_1.RowTransformerValidator; } }));
var HeaderTransformer_1 = __webpack_require__(/*! ./HeaderTransformer */ "./node_modules/@fast-csv/parse/build/src/transforms/HeaderTransformer.js");
Object.defineProperty(exports, "HeaderTransformer", ({ enumerable: true, get: function () { return HeaderTransformer_1.HeaderTransformer; } }));
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "./node_modules/@fast-csv/parse/build/src/types.js":
/*!*********************************************************!*\
  !*** ./node_modules/@fast-csv/parse/build/src/types.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.isSyncValidate = exports.isSyncTransform = void 0;
const isSyncTransform = (transform) => {
    return transform.length === 1;
};
exports.isSyncTransform = isSyncTransform;
const isSyncValidate = (validate) => {
    return validate.length === 1;
};
exports.isSyncValidate = isSyncValidate;
//# sourceMappingURL=types.js.map

/***/ }),

/***/ "./node_modules/lodash.escaperegexp/index.js":
/*!***************************************************!*\
  !*** ./node_modules/lodash.escaperegexp/index.js ***!
  \***************************************************/
/***/ ((module) => {

/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g,
    reHasRegExpChar = RegExp(reRegExpChar.source);

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

/**
 * Escapes the `RegExp` special characters "^", "$", "\", ".", "*", "+",
 * "?", "(", ")", "[", "]", "{", "}", and "|" in `string`.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category String
 * @param {string} [string=''] The string to escape.
 * @returns {string} Returns the escaped string.
 * @example
 *
 * _.escapeRegExp('[lodash](https://lodash.com/)');
 * // => '\[lodash\]\(https://lodash\.com/\)'
 */
function escapeRegExp(string) {
  string = toString(string);
  return (string && reHasRegExpChar.test(string))
    ? string.replace(reRegExpChar, '\\$&')
    : string;
}

module.exports = escapeRegExp;


/***/ }),

/***/ "./node_modules/lodash.groupby/index.js":
/*!**********************************************!*\
  !*** ./node_modules/lodash.groupby/index.js ***!
  \**********************************************/
/***/ ((module, exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/,
    reLeadingDot = /^\./,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && "object" == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding('util');
  } catch (e) {}
}());

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * A specialized version of `baseAggregator` for arrays.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} setter The function to set `accumulator` values.
 * @param {Function} iteratee The iteratee to transform keys.
 * @param {Object} accumulator The initial aggregated object.
 * @returns {Function} Returns `accumulator`.
 */
function arrayAggregator(array, setter, iteratee, accumulator) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    var value = array[index];
    setter(accumulator, value, iteratee(value), array);
  }
  return accumulator;
}

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView'),
    Map = getNative(root, 'Map'),
    Promise = getNative(root, 'Promise'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  return this.has(key) && delete this.__data__[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
}

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  return getMapData(this, key)['delete'](key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  getMapData(this, key).set(key, value);
  return this;
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  this.__data__ = new ListCache(entries);
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  return this.__data__['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var cache = this.__data__;
  if (cache instanceof ListCache) {
    var pairs = cache.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      return this;
    }
    cache = this.__data__ = new MapCache(pairs);
  }
  cache.set(key, value);
  return this;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Aggregates elements of `collection` on `accumulator` with keys transformed
 * by `iteratee` and values set by `setter`.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} setter The function to set `accumulator` values.
 * @param {Function} iteratee The iteratee to transform keys.
 * @param {Object} accumulator The initial aggregated object.
 * @returns {Function} Returns `accumulator`.
 */
function baseAggregator(collection, setter, iteratee, accumulator) {
  baseEach(collection, function(value, key, collection) {
    setter(accumulator, value, iteratee(value), collection);
  });
  return accumulator;
}

/**
 * The base implementation of `_.forEach` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = isKey(path, object) ? [path] : castPath(path);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

/**
 * The base implementation of `getTag`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  return objectToString.call(value);
}

/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return object != null && key in Object(object);
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {boolean} [bitmask] The bitmask of comparison flags.
 *  The bitmask may be composed of the following flags:
 *     1 - Unordered comparison
 *     2 - Partial comparison
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, bitmask, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = getTag(object);
    objTag = objTag == argsTag ? objectTag : objTag;
  }
  if (!othIsArr) {
    othTag = getTag(other);
    othTag = othTag == argsTag ? objectTag : othTag;
  }
  var objIsObj = objTag == objectTag && !isHostObject(object),
      othIsObj = othTag == objectTag && !isHostObject(other),
      isSameTag = objTag == othTag;

  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, equalFunc, customizer, bitmask, stack)
      : equalByTag(object, other, objTag, equalFunc, customizer, bitmask, stack);
  }
  if (!(bitmask & PARTIAL_COMPARE_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, customizer, bitmask, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, equalFunc, customizer, bitmask, stack);
}

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new Stack;
      if (customizer) {
        var result = customizer(objValue, srcValue, key, object, source, stack);
      }
      if (!(result === undefined
            ? baseIsEqual(srcValue, objValue, customizer, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
  // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
  if (typeof value == 'function') {
    return value;
  }
  if (value == null) {
    return identity;
  }
  if (typeof value == 'object') {
    return isArray(value)
      ? baseMatchesProperty(value[0], value[1])
      : baseMatches(value);
  }
  return property(value);
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return matchesStrictComparable(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || baseIsMatch(object, source, matchData);
  };
}

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatchesProperty(path, srcValue) {
  if (isKey(path) && isStrictComparable(srcValue)) {
    return matchesStrictComparable(toKey(path), srcValue);
  }
  return function(object) {
    var objValue = get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? hasIn(object, path)
      : baseIsEqual(srcValue, objValue, undefined, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG);
  };
}

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return baseGet(object, path);
  };
}

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value) {
  return isArray(value) ? value : stringToPath(value);
}

/**
 * Creates a function like `_.groupBy`.
 *
 * @private
 * @param {Function} setter The function to set accumulator values.
 * @param {Function} [initializer] The accumulator object initializer.
 * @returns {Function} Returns the new aggregator function.
 */
function createAggregator(setter, initializer) {
  return function(collection, iteratee) {
    var func = isArray(collection) ? arrayAggregator : baseAggregator,
        accumulator = initializer ? initializer() : {};

    return func(collection, setter, baseIteratee(iteratee, 2), accumulator);
  };
}

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    if (collection == null) {
      return collection;
    }
    if (!isArrayLike(collection)) {
      return eachFunc(collection, iteratee);
    }
    var length = collection.length,
        index = fromRight ? length : -1,
        iterable = Object(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var index = -1,
      result = true,
      seen = (bitmask & UNORDERED_COMPARE_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!seen.has(othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
              return seen.add(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, customizer, bitmask, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, equalFunc, customizer, bitmask, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= UNORDERED_COMPARE_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), equalFunc, customizer, bitmask, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} customizer The function to customize comparisons.
 * @param {number} bitmask The bitmask of comparison flags. See `baseIsEqual`
 *  for more details.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = keys(object),
      length = result.length;

  while (length--) {
    var key = result[length],
        value = object[key];

    result[length] = [key, value, isStrictComparable(value)];
  }
  return result;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11,
// for data views in Edge < 14, and promises in Node.js.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : undefined;

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  path = isKey(path, object) ? [path] : castPath(path);

  var result,
      index = -1,
      length = path.length;

  while (++index < length) {
    var key = toKey(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result) {
    return result;
  }
  var length = object ? object.length : 0;
  return !!length && isLength(length) && isIndex(key, length) &&
    (isArray(object) || isArguments(object));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

/**
 * A specialized version of `matchesProperty` for source values suitable
 * for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function matchesStrictComparable(key, srcValue) {
  return function(object) {
    if (object == null) {
      return false;
    }
    return object[key] === srcValue &&
      (srcValue !== undefined || (key in Object(object)));
  };
}

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoize(function(string) {
  string = toString(string);

  var result = [];
  if (reLeadingDot.test(string)) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to process.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * Creates an object composed of keys generated from the results of running
 * each element of `collection` thru `iteratee`. The order of grouped values
 * is determined by the order they occur in `collection`. The corresponding
 * value of each key is an array of elements responsible for generating the
 * key. The iteratee is invoked with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity]
 *  The iteratee to transform keys.
 * @returns {Object} Returns the composed aggregate object.
 * @example
 *
 * _.groupBy([6.1, 4.2, 6.3], Math.floor);
 * // => { '4': [4.2], '6': [6.1, 6.3] }
 *
 * // The `_.property` iteratee shorthand.
 * _.groupBy(['one', 'two', 'three'], 'length');
 * // => { '3': ['one', 'two'], '5': ['three'] }
 */
var groupBy = createAggregator(function(result, value, key) {
  if (hasOwnProperty.call(result, key)) {
    result[key].push(value);
  } else {
    result[key] = [value];
  }
});

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result);
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Assign cache to `_.memoize`.
memoize.Cache = MapCache;

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': 2 }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b');
 * // => true
 *
 * _.hasIn(object, ['a', 'b']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return object != null && hasPath(object, path, baseHasIn);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': 2 } },
 *   { 'a': { 'b': 1 } }
 * ];
 *
 * _.map(objects, _.property('a.b'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
}

module.exports = groupBy;


/***/ }),

/***/ "./node_modules/lodash.isfunction/index.js":
/*!*************************************************!*\
  !*** ./node_modules/lodash.isfunction/index.js ***!
  \*************************************************/
/***/ ((module) => {

/**
 * Lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright JS Foundation and other contributors <https://js.foundation/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    nullTag = '[object Null]',
    proxyTag = '[object Proxy]',
    undefinedTag = '[object Undefined]';

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol,
    symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isFunction;


/***/ }),

/***/ "./node_modules/lodash.isnil/index.js":
/*!********************************************!*\
  !*** ./node_modules/lodash.isnil/index.js ***!
  \********************************************/
/***/ ((module) => {

/**
 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is `null` or `undefined`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is nullish, else `false`.
 * @example
 *
 * _.isNil(null);
 * // => true
 *
 * _.isNil(void 0);
 * // => true
 *
 * _.isNil(NaN);
 * // => false
 */
function isNil(value) {
  return value == null;
}

module.exports = isNil;


/***/ }),

/***/ "./node_modules/lodash.isundefined/index.js":
/*!**************************************************!*\
  !*** ./node_modules/lodash.isundefined/index.js ***!
  \**************************************************/
/***/ ((module) => {

/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is `undefined`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
 * @example
 *
 * _.isUndefined(void 0);
 * // => true
 *
 * _.isUndefined(null);
 * // => false
 */
function isUndefined(value) {
  return value === undefined;
}

module.exports = isUndefined;


/***/ }),

/***/ "./node_modules/lodash.uniq/index.js":
/*!*******************************************!*\
  !*** ./node_modules/lodash.uniq/index.js ***!
  \*******************************************/
/***/ ((module) => {

/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/**
 * A specialized version of `_.includes` for arrays without support for
 * specifying an index to search from.
 *
 * @private
 * @param {Array} [array] The array to inspect.
 * @param {*} target The value to search for.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludes(array, value) {
  var length = array ? array.length : 0;
  return !!length && baseIndexOf(array, value, 0) > -1;
}

/**
 * This function is like `arrayIncludes` except that it accepts a comparator.
 *
 * @private
 * @param {Array} [array] The array to inspect.
 * @param {*} target The value to search for.
 * @param {Function} comparator The comparator invoked per element.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludesWith(array, value, comparator) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (comparator(value, array[index])) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.findIndex` and `_.findLastIndex` without
 * support for iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} predicate The function invoked per iteration.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseFindIndex(array, predicate, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 1 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    if (predicate(array[index], index, array)) {
      return index;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  if (value !== value) {
    return baseFindIndex(array, baseIsNaN, fromIndex);
  }
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.isNaN` without support for number objects.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
 */
function baseIsNaN(value) {
  return value !== value;
}

/**
 * Checks if a cache value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var splice = arrayProto.splice;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    Set = getNative(root, 'Set'),
    nativeCreate = getNative(Object, 'create');

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  return this.has(key) && delete this.__data__[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
}

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  return getMapData(this, key)['delete'](key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  getMapData(this, key).set(key, value);
  return this;
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * The base implementation of `_.uniqBy` without support for iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} [iteratee] The iteratee invoked per element.
 * @param {Function} [comparator] The comparator invoked per element.
 * @returns {Array} Returns the new duplicate free array.
 */
function baseUniq(array, iteratee, comparator) {
  var index = -1,
      includes = arrayIncludes,
      length = array.length,
      isCommon = true,
      result = [],
      seen = result;

  if (comparator) {
    isCommon = false;
    includes = arrayIncludesWith;
  }
  else if (length >= LARGE_ARRAY_SIZE) {
    var set = iteratee ? null : createSet(array);
    if (set) {
      return setToArray(set);
    }
    isCommon = false;
    includes = cacheHas;
    seen = new SetCache;
  }
  else {
    seen = iteratee ? [] : result;
  }
  outer:
  while (++index < length) {
    var value = array[index],
        computed = iteratee ? iteratee(value) : value;

    value = (comparator || value !== 0) ? value : 0;
    if (isCommon && computed === computed) {
      var seenIndex = seen.length;
      while (seenIndex--) {
        if (seen[seenIndex] === computed) {
          continue outer;
        }
      }
      if (iteratee) {
        seen.push(computed);
      }
      result.push(value);
    }
    else if (!includes(seen, computed, comparator)) {
      if (seen !== result) {
        seen.push(computed);
      }
      result.push(value);
    }
  }
  return result;
}

/**
 * Creates a set object of `values`.
 *
 * @private
 * @param {Array} values The values to add to the set.
 * @returns {Object} Returns the new set.
 */
var createSet = !(Set && (1 / setToArray(new Set([,-0]))[1]) == INFINITY) ? noop : function(values) {
  return new Set(values);
};

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to process.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * Creates a duplicate-free version of an array, using
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons, in which only the first occurrence of each
 * element is kept.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Array
 * @param {Array} array The array to inspect.
 * @returns {Array} Returns the new duplicate free array.
 * @example
 *
 * _.uniq([2, 1, 2]);
 * // => [2, 1]
 */
function uniq(array) {
  return (array && array.length)
    ? baseUniq(array)
    : [];
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * This method returns `undefined`.
 *
 * @static
 * @memberOf _
 * @since 2.3.0
 * @category Util
 * @example
 *
 * _.times(2, _.noop);
 * // => [undefined, undefined]
 */
function noop() {
  // No operation performed.
}

module.exports = uniq;


/***/ }),

/***/ "./src/formatter.ts":
/*!**************************!*\
  !*** ./src/formatter.ts ***!
  \**************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.jsmFormatter = jsmFormatter;
const vscode_1 = __importDefault(__webpack_require__(/*! vscode */ "vscode"));
const formatter = vscode_1.default.workspace.getConfiguration('formatter');
const wordSpacing = formatter.get("wordSpacing");
function jsmFormatter(document) {
    let wordLengthMax = 0;
    let maxWord = "";
    let stack = [];
    let newline = "";
    let space = 16;
    let re = /\s+/g;
    let edits = [];
    let flag = 0;
    //一番文字数の大きい単語を探す
    for (let i = 0; i < document.lineCount; i++) {
        let singleLine = document.lineAt(i).text;
        let wordArray = singleLine.split(re);
        if (!(singleLine.startsWith(".") || singleLine.startsWith("*"))) {
            for (let j = 0; j < wordArray.length; j++) {
                if (wordLengthMax < wordArray[j].length) {
                    wordLengthMax = wordArray[j].length;
                    maxWord = wordArray[j];
                }
            }
        }
    }
    //フォーマッター
    for (let i = 0; i < document.lineCount; i++) {
        let singleLine = document.lineAt(i).text;
        let regex = /(^\.|\*|#|(\s+\n))/;
        if (regex.test(singleLine))
            continue;
        stack = singleLine.split(re);
        for (let j = 0; j < stack.length - 1; j++) {
            newline += stack[j];
            if (stack[j].includes("(")) {
                flag = 1;
            }
            if (stack[j].includes(")")) {
                flag = 0;
            }
            if (flag == 0) {
                let repeatNum = 0;
                let subF = stack[j + 1].length;
                if (j == 0) {
                    subF += stack[j].length;
                }
                repeatNum = wordSpacing - subF;
                while (repeatNum < 1) {
                    repeatNum += space;
                }
                for (let h = 0; h < repeatNum; h++) {
                    newline += " ";
                }
            }
            else {
                newline += " ";
            }
        }
        newline += stack.pop();
        edits.push(vscode_1.default.TextEdit.replace(document.lineAt(i).range, newline));
        newline = "";
        flag = 0;
    }
    return edits;
}
function blockSeparater(content) {
    return content.split("\n\n");
}
function formatOneBlock(block) {
}
function joinBlocks(blocks) {
    return blocks.join("\n\n");
}


/***/ }),

/***/ "./src/main.ts":
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
const superFinder_1 = __webpack_require__(/*! ./superFinder */ "./src/superFinder.ts");
const simulation_exec_1 = __webpack_require__(/*! ./simulation_exec */ "./src/simulation_exec.ts");
const formatter_1 = __webpack_require__(/*! ./formatter */ "./src/formatter.ts");
const JOSIM_MODE = { scheme: "file", language: "josim" };
function getCurrentWord(document, position) {
    const wordRange = document.getWordRangeAtPosition(position, /[\.a-zA-Z0-9_]+/);
    if (wordRange) {
        const currentWord = document
            .lineAt(position.line)
            .text.slice(wordRange.start.character, wordRange.end.character);
        return currentWord;
    }
    throw console.log(`wordRange: ${wordRange}`);
}
class JOSIM_HoverProvider {
    async provideHover(document, position, token) {
        const currentWord = getCurrentWord(document, position);
        let gotText = await (0, superFinder_1.superFinder)(document, currentWord, "range");
        let hoverstring = new vscode.MarkdownString();
        hoverstring.appendCodeblock(gotText, "josim");
        return Promise.resolve(new vscode.Hover(hoverstring));
    }
}
class JOSIM_DefinitionProvider {
    async provideDefinition(document, position, token) {
        const currentWord = getCurrentWord(document, position);
        return (0, superFinder_1.superFinder)(document, currentWord, "loc");
    }
}
let disposable = []; // 修正: 初期化方法を変更
disposable = disposable.concat(vscode.commands.registerCommand("josim-cli.executeSimulation", () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        activeEditor.document.save();
        const uri = activeEditor.document.uri;
        (0, simulation_exec_1.showSimulationResult)(uri);
    }
}));
disposable = disposable.concat(vscode.languages.registerDocumentFormattingEditProvider('josim', {
    provideDocumentFormattingEdits(document) {
        return (0, formatter_1.jsmFormatter)(document);
    }
}));
disposable = disposable.concat(vscode.commands.registerCommand("josim-cli.executeSimulationNoPlot", () => {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor) {
        activeTextEditor.document.save();
        const uri = activeTextEditor.document.uri;
        (0, simulation_exec_1.executeJosimCli)(uri);
    }
}));
function activate(context) {
    context.subscriptions.push(vscode.languages.registerHoverProvider(JOSIM_MODE, new JOSIM_HoverProvider()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(JOSIM_MODE, new JOSIM_DefinitionProvider()));
    const collection = vscode.languages.createDiagnosticCollection('jsm_report');
    for (let i = 0; i < disposable.length; i++) {
        context.subscriptions.push(disposable[i]);
    }
    // if (vscode.window.activeTextEditor) {
    //   checkSyntax(vscode.window.activeTextEditor.document, collection);
    // }
    // context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor: any) => {
    //   if (editor) {
    //     checkSyntax(editor.document, collection);
    //   }
    // }));
    // context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    //   if (event.document === vscode.window.activeTextEditor?.document) {
    //     checkSyntax(event.document, collection);
    //   }
    // }));
    // context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    //   checkSyntax(document, collection);
    // }));
}
function deactivate() {
    return undefined;
}


/***/ }),

/***/ "./src/simulation_exec.ts":
/*!********************************!*\
  !*** ./src/simulation_exec.ts ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.showSimulationResult = showSimulationResult;
exports.executeJosimCli = executeJosimCli;
const child_process_1 = __webpack_require__(/*! child_process */ "child_process");
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
const fs = __importStar(__webpack_require__(/*! fs */ "fs"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const csv = __importStar(__webpack_require__(/*! @fast-csv/parse */ "./node_modules/@fast-csv/parse/build/src/index.js"));
function load_config() {
    saveImage = vscode.workspace.getConfiguration('saveImage');
    toImageFormat = saveImage.get('Format');
    downloadImageWidth = saveImage.get('Width');
    downloadImageHeight = saveImage.get('Height');
    downloadImageFontSize = saveImage.get('fontsize');
    tmpFiles = vscode.workspace.getConfiguration("tmpFiles");
    saveCount = tmpFiles.get("saveCount");
    graphConfig = vscode.workspace.getConfiguration("graph");
    prefixUnit = graphConfig.get("timescale");
}
let saveImage = vscode.workspace.getConfiguration('saveImage');
let toImageFormat = saveImage.get('Format');
let downloadImageWidth = saveImage.get('Width');
let downloadImageHeight = saveImage.get('Height');
let downloadImageFontSize = saveImage.get('fontsize');
let tmpFiles = vscode.workspace.getConfiguration("tmpFiles");
let saveCount = tmpFiles.get("saveCount");
let graphConfig = vscode.workspace.getConfiguration("graph");
let prefixUnit = graphConfig.get("timescale");
let josimProcessPid = [];
async function showSimulationResult(uri) {
    let fspath = uri.fsPath;
    if (fspath.includes(" ")) {
        let suggest = fspath.replaceAll(" ", "_");
        let message = "Josim file name should not have 'space', please rename it.\nsuggested: " + suggest;
        vscode.window.showErrorMessage(message);
    }
    else {
        let tmp = await getFileNamesInFolder(path.join(path.dirname(fspath), "josim_resultCSV"));
        autoDeleteTmpFiles(tmp);
        //マージンを取る時もこれより下の部分を書き換えれば対応できる。
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "",
            cancellable: true
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                if (josimProcessPid.length > 0) {
                    const pid = josimProcessPid.pop();
                    try {
                        process.kill(pid);
                        // console.log(`Process ${pid} was terminated`);
                    }
                    catch (err) {
                        console.error(`Failed to kill process ${pid}:`, err);
                    }
                }
                return;
            });
            progress.report({ increment: 0 });
            progress.report({ increment: 10, message: "Simulation progressing" });
            let resultFilePath = await simulation_exec(fspath);
            progress.report({ increment: 70, message: "Exporting output file" });
            let result_html = await simulationResult2html(resultFilePath);
            progress.report({ increment: 80, message: "Loading HTML" });
            ShowPlotDraw(result_html, fspath);
        });
    }
}
async function executeJosimCli(uri) {
    let fspath = uri.fsPath;
    if (fspath.includes(" ")) {
        let suggest = fspath.replaceAll(" ", "_");
        let message = "Josim file name should not have 'space', please rename it.\nsuggested: " + suggest;
        vscode.window.showErrorMessage(message);
    }
    else {
        let simulationResultPath = path.join(path.dirname(fspath), "josim_resultCSV");
        let fileNames = await getFileNamesInFolder(simulationResultPath);
        autoDeleteTmpFiles(fileNames);
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "",
            cancellable: true
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                if (josimProcessPid.length > 0) {
                    const pid = josimProcessPid.pop();
                    try {
                        process.kill(pid);
                        console.log(`Process ${pid} was terminated`);
                    }
                    catch (err) {
                        console.error(`Failed to kill process ${pid}:`, err);
                    }
                }
                return;
            });
            progress.report({ increment: 0 });
            progress.report({ increment: 10, message: "Simulating......" });
            await simulation_exec(fspath);
            progress.report({ increment: 100, message: "Simulation done!" });
        });
    }
}
async function simulation_exec(fspath) {
    let filePath = path.parse(fspath).base;
    if (filePath.includes(' ')) {
        vscode.window.showInformationMessage("filename should not contain ' '.");
    }
    filePath = path.join(path.parse(fspath).dir, "josim_resultCSV");
    fs.mkdir(filePath, (err) => {
        if (err) {
            throw "err: " + err;
        }
    });
    const date = new Date();
    const timestump = String(date.getFullYear()) + String(date.getMonth() + 1) + String(date.getDate()) + "_" + String(date.getHours()) + String(date.getMinutes()) + String(date.getSeconds());
    const outputFilePath = path.join(filePath, 'jsm_out' + "_" + timestump + '.csv');
    const string_for_exec = 'josim-cli ' + fspath + ' -o ' + outputFilePath + ' -m';
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.exec)(string_for_exec, (err, stdout, stderr) => {
            if (err) {
                if (stderr.includes("Terminated")) {
                    reject(vscode.window.showInformationMessage("Simulation ", stderr));
                }
                else {
                    reject(vscode.window.showErrorMessage(stderr));
                }
            }
            resolve(outputFilePath);
        });
        if (child.pid !== undefined) {
            josimProcessPid.push(child.pid + 1);
        }
    });
}
let currentWebviewPanel;
function ShowPlotDraw(result_html, filename) {
    let name = path.parse(filename).name;
    const panelTitle = `Plot-result: ${name}`;
    // 既存のパネルがある場合はHTMLを更新
    if (currentWebviewPanel != undefined) {
        currentWebviewPanel.title = panelTitle;
        currentWebviewPanel.webview.html = result_html;
        currentWebviewPanel.reveal(undefined, true); // パネルをアクティブにする
    }
    else {
        // 新しいパネルを作成
        currentWebviewPanel = vscode.window.createWebviewPanel("plotData", panelTitle, {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true
        }, {
            enableScripts: true
        });
        currentWebviewPanel.webview.html = result_html;
        // パネルが閉じられた時の処理
        currentWebviewPanel.onDidDispose(() => {
            currentWebviewPanel = undefined;
        });
    }
}
function getCsvResultFromSimulation(csvFilePath) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(csvFilePath)
            .pipe(csv.parse());
        stream.on('error', (error) => reject(error));
        const data = [];
        stream.on('data', (chunk) => data.push(chunk));
        stream.on('end', () => resolve(data));
    });
}
const transpose = (a) => a[0].map((_, c) => a.map((r) => r[c]));
async function simulationResult2html(csvFilePath) {
    let htmlScript = " ";
    let divScript = " ";
    let unit;
    let phaseDataScript = " ";
    let currentDataScript = " ";
    let vonltageDataScript = " ";
    let time = [];
    let value = [];
    let trace = [];
    let name = [];
    let data = [];
    let phaseData = [];
    let currentData = [];
    let voltageData = [];
    let phaseMaxes = [];
    let phaseMins = [];
    let pFlag = 0;
    let iFlag = 0;
    let vFlag = 0;
    const reP = /^P/;
    const reI = /^I/;
    const reV = /^V/;
    const phaseTitle = "Phase [rad]";
    const currentTitle = "Current [μA]";
    const voltageTitle = "Voltage [μV]";
    load_config();
    const xaxisLabelPrefixUnit = prefixUnit.substr(0, 1);
    const xaxis = {
        title: "Time [" + xaxisLabelPrefixUnit + "s]",
        showexponent: 'all',
        exponentformat: 'e'
    };
    const font = {
        family: "Times New Roman",
        size: downloadImageFontSize
    };
    let layout = (unit) => {
        return {
            xaxis: xaxis,
            yaxis: {
                title: unit,
            },
            font: font
        };
    };
    let phaseLayout = {
        xaxis: xaxis,
        yaxis: {
            title: phaseTitle,
            tickvals: [],
            ticktext: [],
            tickmode: "array",
            tickangle: "auto"
        },
        font: font
    };
    const config = {
        "responsive": true,
        'modeBarButtonsToRemove': ['toImage'],
        "editable": true
    };
    let resolve = await getCsvResultFromSimulation(csvFilePath);
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    name = resolve[0];
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    resolve.shift();
    name.shift();
    const transposed = transpose(resolve);
    let digitLength = 0;
    switch (xaxisLabelPrefixUnit) {
        case "m":
            digitLength = 1e3;
            break;
        case "u":
            digitLength = 1e6;
            break;
        case "n":
            digitLength = 1e9;
            break;
        case "p":
            digitLength = 1e12;
            break;
        case "f":
            digitLength = 1e15;
            break;
        default:
            break;
    }
    time = transposed[0].map((val) => val * digitLength);
    value = transposed;
    value.shift();
    let i = 0;
    for (i = 0; i < name.length; i++) {
        if (reP.test(name[i])) {
            pFlag = 1;
        }
        if (reI.test(name[i])) {
            iFlag = 1;
        }
        if (reV.test(name[i])) {
            vFlag = 1;
        }
    }
    for (i = 0; i < name.length; i++) {
        trace = {
            // @ts-expect-error TS(2322): Type '{ x: any; y: any; name: any; type: string; }... Remove this comment to see the full error message
            x: time,
            y: value[i],
            name: name[i],
            type: 'scatter',
        };
        data.push(trace);
    }
    for (i = 0; i < name.length; i++) {
        if (reP.test(name[i])) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            data[i].y = data[i].y.map((val) => {
                return val / Math.PI;
            });
            phaseData.push(data[i]);
        }
        else if (reI.test(name[i])) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            data[i].y = data[i].y.map((val) => {
                return val * digitLength;
            });
            currentData.push(data[i]);
        }
        else if (reV.test(name[i])) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            data[i].y = data[i].y.map((val) => {
                return val * digitLength;
            });
            voltageData.push(data[i]);
        }
    }
    if (pFlag > 0) {
        const aryMax = function (a, b) { return Math.max(a, b); };
        const aryMin = function (a, b) { return Math.min(a, b); };
        for (let i = 0; i < Object.keys(phaseData).length; i++) {
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            phaseMaxes.push(phaseData[i].y.reduce(aryMax));
            // @ts-expect-error TS(2304): Cannot find name 'i'.
            phaseMins.push(phaseData[i].y.reduce(aryMin));
        }
        const phaseMax = Math.trunc(phaseMaxes.reduce(aryMax));
        const phaseMin = Math.trunc(phaseMins.reduce(aryMin));
        for (let i = phaseMin; i <= phaseMax; i++) {
            phaseLayout.yaxis.tickvals.push(i);
            let txt;
            if (i == -1) {
                txt = "\u{1D70B}";
            }
            else if (i == 0) {
                txt = "0";
            }
            else if (i == 1) {
                txt = "\u{1D70B}";
            }
            else {
                txt = `${String(i)}\u{1D70B}`;
            }
            txt = txt + '\t';
            phaseLayout.yaxis.ticktext.push(txt);
        }
        phaseDataScript = `
        Plotly.newPlot(
            "phasePlot",
            ${JSON.stringify(phaseData)},
            ${JSON.stringify(phaseLayout)},
            ${JSON.stringify(config)}
        )
        `;
        htmlScript += phaseDataScript;
        divScript += `<div id="phasePlot"></div>
        <button onclick="saveAsImage('phasePlot')">↑Save as ${toImageFormat}</button>
        `;
    }
    if (iFlag > 0) {
        unit = currentTitle;
        currentDataScript = `
        Plotly.newPlot(
            "currentPlot",
            ${JSON.stringify(currentData)},
            ${JSON.stringify(layout(unit))},
            ${JSON.stringify(config)}
        )
        `;
        htmlScript += currentDataScript;
        divScript += ` <div id="currentPlot"></div>
        <button onclick="saveAsImage('currentPlot')">↑Save as ${toImageFormat}</button>
        `;
    }
    if (vFlag > 0) {
        unit = voltageTitle;
        vonltageDataScript = `
        Plotly.newPlot(
            "voltagePlot",
            ${JSON.stringify(voltageData)},
            ${JSON.stringify(layout(unit))},
            ${JSON.stringify(config)}
        )
        `;
        htmlScript += vonltageDataScript;
        divScript += `<div id="voltagePlot"></div>
        <button onclick="saveAsImage('voltagePlot')">↑Save as ${toImageFormat}</button>
        `;
    }
    const showdata = {
        script: htmlScript,
        div: divScript
    };
    const saveImageConfig = `{format: '${toImageFormat}' , width: ${downloadImageWidth}, height: ${downloadImageHeight}}`;
    const result_html = `<!DOCTYPE html>
    <html>
        <head>
        <script src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_SVG"></script>
        <script src="https://cdn.plot.ly/plotly-latest.min.js" ></script>
        </head>
        <body>
        ${showdata.div}
        <script>
            ${showdata.script}
            function saveAsImage(id) {
                var plotlyGraph = document.getElementById(id);
                Plotly.toImage(plotlyGraph,${saveImageConfig})
                    .then(function (url) {
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = 'plot.${toImageFormat}';
                        a.click();
                    });
            }
        </script>
        </body>
    </html>
  `;
    const outputHtmlPath = csvFilePath.replace(".csv", ".html");
    fs.writeFileSync(outputHtmlPath, result_html.replace("<!DOCTYPE html>\n", ""));
    return result_html;
}
async function getFileNamesInFolder(folderPath) {
    try {
        const filesInfo = [];
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, '*'));
        for (const file of files) {
            const fileName = path.basename(file.fsPath);
            const stats = fs.statSync(file.fsPath);
            const createdTime = stats.birthtime.getTime();
            filesInfo.push({ fileName, filePath: file.fsPath, createdTime });
        }
        let sortedFiles = filesInfo.sort((a, b) => b.createdTime - a.createdTime);
        let returnArray = [];
        sortedFiles.forEach(file => {
            returnArray.push(file.filePath);
        });
        return returnArray;
    }
    catch (error) {
        console.error('Error occurred while getting file names:', error);
        return [];
    }
}
async function autoDeleteTmpFiles(filenames) {
    let basenameArray = [];
    let noDuplicates = [];
    filenames.forEach((file) => {
        basenameArray.push(file.replace(/\..+/, ""));
    });
    noDuplicates = Array.from(new Set(basenameArray));
    for (let i = Number(saveCount) - 1; i < noDuplicates.length; i++) {
        let regexSource = noDuplicates[i] + "\..+";
        let re = new RegExp(regexSource);
        filenames.filter(function (value) { return value.match(re); }).forEach((fname) => {
            fs.unlinkSync(fname);
        });
    }
    // console.log(noDuplicates);
}


/***/ }),

/***/ "./src/superFinder.ts":
/*!****************************!*\
  !*** ./src/superFinder.ts ***!
  \****************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.superFinder = superFinder;
const vscode_1 = __importDefault(__webpack_require__(/*! vscode */ "vscode"));
async function superFinder(document, currentWord, mode) {
    let uri = await docSelector(document);
    if (uri != null) {
        for (const docuri of uri) {
            const refDoc = await vscode_1.default.workspace.openTextDocument(docuri);
            let result = findwhere(refDoc, currentWord, mode);
            if (result != null) {
                return result;
            }
        }
    }
    return null;
}
async function docSelector(document) {
    var text = document.getText();
    var searchStr = new RegExp(/\.include\s+(\S+)/, "g");
    var incFileName = text.match(searchStr) || [];
    var refFileName = [];
    for (var i = 0; i < incFileName.length; i++) {
        var tmp = incFileName[i].match(/\.include\s+(\S+)/m);
        refFileName[i] = tmp[1];
    }
    if (refFileName.length === 0) {
        return null;
    }
    var docUri = [];
    for (const fileName of refFileName) {
        docUri.push(vscode_1.default.Uri.file(fileName));
    }
    return docUri;
}
function findwhere(document, currentWord, mode) {
    if (currentWord == ".subckt") {
        throw vscode_1.default.window.showInformationMessage("This is the definition.");
    }
    var text = document.getText();
    var loc = null;
    const searchStr = new RegExp("^\\.subckt\\s+" + currentWord, "m");
    const startIndex = text.search(searchStr);
    const searchStr_alt = new RegExp("^" + currentWord, "m");
    const startIndex_alt = text.search(searchStr_alt);
    if (startIndex > -1) {
        const pos = document.positionAt(startIndex);
        var nonl_text = text.replace(/[\s\n]/gm, "o");
        const sub_endIndex = nonl_text.indexOf("ends", startIndex);
        const endIndex = nonl_text.indexOf("s", sub_endIndex);
        const endposition = document.positionAt(endIndex + 1);
        const range = new vscode_1.default.Range(pos, endposition);
        loc = new vscode_1.default.Location(document.uri, pos); // locの値を設定
        const hitchar = document.lineAt(pos).text.indexOf(currentWord);
        if (mode === "loc")
            return loc;
        // @ts-expect-error TS(2304): Cannot find name 'position'.
        else if (mode === "hitline")
            return document.lineAt(position);
        else if (mode === "hitchar")
            return hitchar;
        else if (mode === "range") {
            return document.getText(range);
        }
        else
            console.log("mode isn't defined");
    }
    else if (startIndex_alt > -1) {
        const pos = document.positionAt(startIndex_alt);
        const scriptRange = document.lineAt(pos);
        loc = new vscode_1.default.Location(document.uri, pos); // locの値を設定
        const hitchar = document.lineAt(pos).text.indexOf(currentWord);
        if (mode === "loc")
            return loc;
        // @ts-expect-error TS(2304): Cannot find name 'position'.
        else if (mode === "hitline")
            return document.lineAt(position);
        else if (mode === "hitchar")
            return hitchar;
        else if (mode === "range") {
            return scriptRange.text;
        }
        else
            console.log("mode isn't defined");
    }
    else
        console.log("search failed");
    throw console.log(`${currentWord} not found`);
}


/***/ }),

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("stream");

/***/ }),

/***/ "string_decoder":
/*!*********************************!*\
  !*** external "string_decoder" ***!
  \*********************************/
/***/ ((module) => {

"use strict";
module.exports = require("string_decoder");

/***/ }),

/***/ "vscode":
/*!*************************!*\
  !*** external "vscode" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("vscode");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			loaded: false,
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/node module decorator */
/******/ 	(() => {
/******/ 		__webpack_require__.nmd = (module) => {
/******/ 			module.paths = [];
/******/ 			if (!module.children) module.children = [];
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main.ts");
/******/ 	var __webpack_export_target__ = exports;
/******/ 	for(var __webpack_i__ in __webpack_exports__) __webpack_export_target__[__webpack_i__] = __webpack_exports__[__webpack_i__];
/******/ 	if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map