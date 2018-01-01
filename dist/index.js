'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const crypto = require('crypto');
const path = require('path');
const fse = require('fs-extra');
const globby = require('globby');

const fixedRootFiles = ['favicon.ico', 'humans.txt', 'robots.txt', 'sitemap.xml', '.well-known'];

const fixedNamesPatterns = ['!**/.well-known/**'];

const ensureArray = item => Array.isArray(item) ? item : [item];

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

const renameStatics = (() => {
  var _ref = _asyncToGenerator(function* (src, staticPatterns, shouldCopy) {
    const mapping = {};
    const files = yield globby(staticPatterns, { cwd: src });
    const promises = files.map((() => {
      var _ref2 = _asyncToGenerator(function* (file) {
        const filename = path.resolve(src, file);
        const contents = yield fse.readFile(filename);
        const checksum = hashFile(contents);
        const newFile = generateNewName(file, checksum);
        if (shouldCopy) {
          yield fse.copy(filename, path.resolve(src, newFile));
        } else {
          yield fse.rename(filename, path.resolve(src, newFile));
        }
        mapping[file] = newFile;
      });

      return function (_x4) {
        return _ref2.apply(this, arguments);
      };
    })());
    yield Promise.all(promises);
    return mapping;
  });

  return function renameStatics(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
})();

const shuffleDirs = (() => {
  var _ref3 = _asyncToGenerator(function* (staticSrc, staticTarget, overwrite) {
    staticSrc = path.resolve(staticSrc);
    if (overwrite) {
      const tmpSrc = path.join(path.dirname(staticSrc), '__static');
      yield fse.rename(staticSrc, tmpSrc);
      yield fse.ensureDir(path.dirname(staticTarget));
      yield fse.move(tmpSrc, staticTarget);
    } else {
      yield fse.copy(staticSrc, staticTarget);
    }
  });

  return function shuffleDirs(_x5, _x6, _x7) {
    return _ref3.apply(this, arguments);
  };
})();

const getAllPatterns = (staticPatterns, rootFiles) => {
  staticPatterns = ensureArray(staticPatterns);
  return staticPatterns.concat(fixedNamesPatterns).concat(rootFiles.map(file => `!${file}`));
};

const replaceRefs = (() => {
  var _ref4 = _asyncToGenerator(function* (dir, patterns, currentPrefix, targetPrefix, mappings) {
    targetPrefix = trimSlashes(targetPrefix);
    const files = yield globby(patterns, { cwd: path.resolve(dir) });
    const regex = new RegExp(`(['"])\/${trimSlashes(currentPrefix)}/(.*?)(['"?])`, 'g');
    const report = {};

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = files[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        let file = _step.value;

        const filename = path.resolve(dir, file);
        const contents = yield fse.readFile(filename, 'utf-8');
        const replaced = contents.replace(regex, function (match, p1, fragment, p3) {
          fragment = mappings[fragment] || fragment;
          const newUrl = `${p1}/${targetPrefix}/${fragment}${p3}`;
          const list = report[file] || [];
          list.push({ from: match, to: newUrl });
          report[file] = list;
          return newUrl;
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

    return report;
  });

  return function replaceRefs(_x8, _x9, _x10, _x11, _x12) {
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

  return function bumpRootFiles(_x13, _x14, _x15) {
    return _ref5.apply(this, arguments);
  };
})();

const cachebust = (() => {
  var _ref6 = _asyncToGenerator(function* ({
    currentPrefix,
    distDir,
    extraRootFiles = [],
    moveRootFiles = false,
    overwrite,
    replacePatterns = '**/*.+(js|json|css|html)',
    staticSrc,
    staticDest,
    staticPatterns = ['**/*'],
    targetPrefix
  } = {}) {
    if (!distDir) {
      throw new Error('distDir property is required');
    }
    distDir = path.resolve(distDir);
    if (!currentPrefix) {
      throw new Error('currentPrefix is required');
    }
    staticSrc = staticSrc ? path.resolve(distDir, staticSrc) : path.resolve(distDir, toPath(currentPrefix));
    staticDest = staticDest ? path.resolve(distDir, staticDest) : distDir;
    targetPrefix = targetPrefix || currentPrefix;
    overwrite = staticSrc.startsWith(distDir);
    const staticTarget = path.join(staticDest, toPath(targetPrefix));
    extraRootFiles = ensureArray(extraRootFiles);
    const allRootFiles = fixedRootFiles.concat(extraRootFiles);
    const allPatterns = getAllPatterns(staticPatterns, allRootFiles);

    try {
      const sameDir = staticSrc === staticTarget;
      if (!sameDir) {
        yield shuffleDirs(staticSrc, staticTarget, overwrite);
      }
      const shouldCopy = sameDir && !overwrite;
      const mappings = yield renameStatics(staticTarget, allPatterns, shouldCopy);
      const report = yield replaceRefs(distDir, replacePatterns, currentPrefix, targetPrefix, mappings);
      console.log(report);
      if (moveRootFiles) {
        bumpRootFiles(staticTarget, staticDest, allRootFiles);
      }
    } catch (e) {
      console.log(e);
    }
  });

  return function cachebust() {
    return _ref6.apply(this, arguments);
  };
})();

module.exports = cachebust;
module.exports.NEXT = {
  distDir: './next',
  staticSrc: './static',
  currentPrefix: '/static',
  overwrite: false
};
module.exports.CRA = {
  distDir: './build',
  currentPrefix: '/public'
};
//# sourceMappingURL=index.js.map