function saveToFirebase (ref, json) {
  return new Promise(function (resolve) {
    ref.update(json);  
    resolve();
  });
};

function queryFromFirebase (ref) {
  return new Promise(function (resolve) {
    ref.once('value').then(function (snapshot) {
      resolve(snapshot.val());
    });
  })
};

function removeFromFirebase (ref) {
  return new Promise(function (resolve) {
    ref.remove().then(function () {
      resolve();
    });
  });
};

module.exports = {
  save: saveToFirebase,
  query: queryFromFirebase,
  remove: removeFromFirebase
}