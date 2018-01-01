'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const crypto = require('crypto');
const path = require('path');
const fse = require('fs-extra');
const globby = require('globby');

const fixedRootFiles = ['favicon.ico', 'humans.txt', 'robots.txt', 'sitemap.xml', '.well-known'];

const fixedNamesPatterns = ['!**/.well-known/**'];

const hashFile = contents => {
  const hash = crypto.createHash('sha256');
  hash.update(contents);
  return hash.digest('hex').substring(0, 8);
};

const generateNewName = (file, checksum) => {
  const dirname = path.dirname(file);
  const ext = path.extname(file);
  const basename = path.basename(file, ext);
  return path.join(dirname, `${basename}.${checksum}${ext}`);
};

const trimSlashes = str => {
  if (str.startsWith('/')) {
    str = str.substring(1);
  }
  if (str.endsWith('/')) {
    str = str.substring(0, str.length - 1);
  }
  return str;
};

const toPath = str => {
  str = trimSlashes(str);
  return str.replace('/', path.sep);
};

const renameStatics = (() => {
  var _ref = _asyncToGenerator(function* (src, staticPatterns) {
    const mapping = {};
    const files = yield globby(staticPatterns, { cwd: src });
    const promises = files.map((() => {
      var _ref2 = _asyncToGenerator(function* (file) {
        const filename = path.resolve(src, file);
        const contents = yield fse.readFile(filename);
        const checksum = hashFile(contents);
        const newFile = generateNewName(file, checksum);
        yield fse.rename(filename, path.resolve(src, newFile));
        mapping[file] = newFile;
      });

      return function (_x3) {
        return _ref2.apply(this, arguments);
      };
    })());
    yield Promise.all(promises);
    return mapping;
  });

  return function renameStatics(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

const shuffleDirs = (() => {
  var _ref3 = _asyncToGenerator(function* (staticSrc, staticTarget, targetPrefix) {
    staticSrc = path.resolve(staticSrc);
    const tmpSrc = path.join(path.dirname(staticSrc), '__static');
    yield fse.rename(staticSrc, tmpSrc);
    yield fse.ensureDir(path.dirname(staticTarget));
    yield fse.move(tmpSrc, staticTarget);
  });

  return function shuffleDirs(_x4, _x5, _x6) {
    return _ref3.apply(this, arguments);
  };
})();

const getAllPatterns = (staticPatterns, rootFiles) => {
  staticPatterns = Array.isArray(staticPatterns) ? staticPatterns : [staticPatterns];
  return staticPatterns.concat(fixedNamesPatterns).concat(rootFiles.map(file => `!${file}`));
};

const replaceRefs = (() => {
  var _ref4 = _asyncToGenerator(function* (dir, patterns, currentPrefix, targetPrefix, mappings) {
    targetPrefix = trimSlashes(targetPrefix);
    const files = yield globby(patterns, { cwd: path.resolve(dir) });
    const regex = new RegExp(`(['"])\/${trimSlashes(currentPrefix)}/(.*?)(['"?])`, 'g');

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = files[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        let file = _step.value;

        const filename = path.resolve(dir, file);
        const contents = yield fse.readFile(filename, 'utf-8');
        const replaced = contents.replace(regex, function (match, p1, uri, p3) {
          const newUri = mappings[uri] || uri;
          return `${p1}/${targetPrefix}/${newUri}${p3}`;
        });
        yield fse.writeFile(filename, replaced);
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  });

  return function replaceRefs(_x7, _x8, _x9, _x10, _x11) {
    return _ref4.apply(this, arguments);
  };
})();

const bumpRootFiles = (() => {
  var _ref5 = _asyncToGenerator(function* (currentDir, rootDir, rootFiles) {
    const fullFiles = rootFiles.map(function (file) {
      return path.resolve(currentDir, file);
    });
    const uniqueFiles = [...new Set(fullFiles)];
    const existingFiles = uniqueFiles.filter(function (file) {
      return fse.pathExistsSync(file);
    });
    const promises = existingFiles.map(function (file) {
      const newFile = path.join(rootDir, path.basename(file));
      fse.move(file, newFile);
    });
    yield Promise.all(promises);
  });

  return function bumpRootFiles(_x12, _x13, _x14) {
    return _ref5.apply(this, arguments);
  };
})();

const cachebust = (() => {
  var _ref6 = _asyncToGenerator(function* ({
    cwd = './.next',
    replacePatterns = '**/*.+(js|json|css|html)',
    staticSrc,
    staticDest,
    staticPatterns = ['**/*'],
    currentPrefix = '/static',
    targetPrefix = '/static',
    extraRootFiles = [],
    moveRootFiles = false
  } = {}) {
    staticSrc = staticSrc || path.join(cwd, 'static');
    staticDest = staticDest || cwd;
    const staticTarget = path.join(staticDest, toPath(targetPrefix));

    yield shuffleDirs(staticSrc, staticTarget, targetPrefix);
    extraRootFiles = Array.isArray(extraRootFiles) ? extraRootFiles : [extraRootFiles];
    const allRootFiles = fixedRootFiles.concat(extraRootFiles);
    const allPatterns = getAllPatterns(staticPatterns, allRootFiles);
    const mappings = yield renameStatics(staticTarget, allPatterns);
    yield replaceRefs(cwd, replacePatterns, currentPrefix, targetPrefix, mappings);
    if (moveRootFiles) {
      bumpRootFiles(staticTarget, staticDest, allRootFiles);
    }
  });

  return function cachebust() {
    return _ref6.apply(this, arguments);
  };
})();

module.exports = cachebust;
//# sourceMappingURL=index.js.map