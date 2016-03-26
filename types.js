define(function () {
"use strict";

const Types = {}; // build an enumeration of all TypedArray types
for (let type of ['Int', 'Uint', 'Float']) {
  for (let bits = 8; bits <= 64; bits <<= 1) {
    if (bits < 64 || type === 'Float') {
      const typeName = type + bits;
      Types[typeName] = {size: bits >> 3, logSize: Math.log2(bits >> 3)|0, get: DataView.prototype['get' + typeName], set: DataView.prototype['set' + typeName]}
    }
  }
}

function nextPowerOf2(n) { // see https://graphics.stanford.edu/~seander/bithacks.html
  var v = n|0;
  v--;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  v++;
  return v;
}

Types.Struct = function (shape) {
  const self = (function () { // Create a private scope for self construction
    const members = Object.keys(shape);
    const obj = { // Precalculate members offsets and data accessors
      properties: members,
      getters: members.map(member => shape[member].get),
      setters: members.map(member => shape[member].set),
      offsets: new Array(members.length)
    };
    let currentMemberOffset = 0;
    for (let i = 0; i < obj.properties.length; i++) {
      const member = obj.properties[i];
      obj.offsets[i] = currentMemberOffset;
      currentMemberOffset += shape[member].size;
    }
    obj.globalLogOffset = Math.log2(nextPowerOf2(currentMemberOffset));
    return obj;
  })();

  self.memberOffset = function (n, member) {
    return ((n << this.globalLogOffset) + this.offsets[member])|0;
  }

  self.Array = function (length) {
    this.length = length;
    this.dataView = new DataView(new ArrayBuffer(length << self.globalLogOffset));
  }
  self.Array.prototype = {
    get (n) {
      var tmpVal = new Array(self.properties.length);
      for (var i = 0; i < tmpVal.length; i++) {
        tmpVal[i] = self.getters[i].call(this.dataView, self.memberOffset(n, i));
      }
      return tmpVal;
    },
    set (n, values) {
      for (var i = 0; i < values.length; i++) {
        self.setters[i].call(this.dataView, self.memberOffset(n, i), values[i]);
      }
    },
    ensureCapacity (capacity) {
      if (this.dataView.buffer.byteLength < (capacity << self.globalLogOffset)) {
        const newBuffer = new ArrayBuffer(nextPowerOf2(capacity) << self.globalLogOffset);
        const copier = new Float64Array(newBuffer); // we only build a view to copy the internal buffer
        copier.set(new Float64Array(this.dataView.buffer));
        this.dataView = new DataView(newBuffer);
      }
    },
    push (values) {
      this.length++;
      this.ensureCapacity(this.length);
      this.set(this.length - 1, values);
    }
  };
  return self;
}

return Types;
});
