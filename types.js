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
  const members = Object.keys(shape);
  const offsets = new Array(members);
  const getters = members.map(member => shape[member].get);
  const setters = members.map(member => shape[member].set);
  const membersLogSizes = members.map(member => shape[member].logSize);

  const self = function (...values) {
    for (let i = 0; i < values.length; i++) {
      this[members[i]] = values[i];
    }
  };
  self.properties = members;
  self.offsets = offsets;
  let currentMemberOffset = 0;
  for (let [i, member] of self.properties.entries()) {
    self.offsets[i] = currentMemberOffset;
    currentMemberOffset += shape[member].size;
  }
  let globalOffset = nextPowerOf2(currentMemberOffset);
  self.globalLogOffset = Math.log2(globalOffset)|0;

  self.Array = function (length) {
    this.length = length;
    this.dataView = new DataView(new ArrayBuffer(length << self.globalLogOffset));
  }
  self.Array.prototype = {
    memberOffset (n, member) {
      return ((n << self.globalLogOffset) + self.offsets[member]);
    },
    get (n) {
      return new self(...self.properties.map((_, member) => getters[member].call(this.dataView, this.memberOffset(n, member))));
    },
    set (n, values) {
      for (let [i, member] of self.properties.entries()) {
        setters[i].call(this.dataView, this.memberOffset(n, i), values[member]);
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
