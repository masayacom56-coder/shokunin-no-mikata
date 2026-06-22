const fs = require("fs");
const originalReadFileSync = fs.readFileSync;
const originalReadFile = fs.promises.readFile;

fs.readFileSync = function patchedReadFileSync(path, ...args) {
  try {
    return originalReadFileSync.call(this, path, ...args);
  } catch (error) {
    if (error && error.code === "ETIMEDOUT") {
      console.error("[readFileSync ETIMEDOUT]", path);
    }
    throw error;
  }
};

fs.promises.readFile = async function patchedReadFile(path, ...args) {
  try {
    return await originalReadFile.call(this, path, ...args);
  } catch (error) {
    if (error && error.code === "ETIMEDOUT") {
      console.error("[readFile ETIMEDOUT]", path);
    }
    throw error;
  }
};
