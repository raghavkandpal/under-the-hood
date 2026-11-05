// Text editor buffers: naive array, gap buffer, piece table. Each counts characters copied, the main cost. No DOM.

/** A plain array of characters: inserting shifts everything after the cursor. */
export class Naive {
  constructor(text = "") { this.a = [...text]; this.moved = 0; }
  insert(pos, s) { this.moved += this.a.length - pos; this.a.splice(pos, 0, ...s); }
  remove(pos, n) { this.moved += Math.max(0, this.a.length - pos - n); this.a.splice(pos, n); }
  text() { return this.a.join(""); }
}

/** Gap buffer (Emacs): free space sits at the cursor, so typing there is O(1); moving the cursor moves the gap. */
export class GapBuffer {
  constructor(text = "", cap = 16) {
    const n = text.length; this.buf = new Array(Math.max(cap, n + 4)).fill(null);
    [...text].forEach((c, i) => (this.buf[i] = c)); this.gs = n; this.ge = this.buf.length; this.moved = 0; this.grows = 0;
  }
  get length() { return this.buf.length - (this.ge - this.gs); }
  get gap() { return this.ge - this.gs; }
  moveTo(pos) {
    if (this.gs === this.ge) { this.gs = this.ge = pos; return; } // no gap: nothing to move
    while (this.gs > pos) { this.buf[--this.ge] = this.buf[--this.gs]; this.buf[this.gs] = null; this.moved++; }
    while (this.gs < pos) { this.buf[this.gs++] = this.buf[this.ge]; this.buf[this.ge++] = null; this.moved++; }
  }
  grow() {
    const old = this.buf, extra = old.length, tail = old.slice(this.ge);
    this.buf = old.slice(0, this.gs).concat(new Array(this.ge - this.gs + extra).fill(null), tail);
    this.ge += extra; this.moved += old.length - (this.ge - extra - this.gs); this.grows++;
  }
  insert(pos, s) { this.moveTo(pos); for (const c of s) { if (this.gs === this.ge) this.grow(); this.buf[this.gs++] = c; } }
  remove(pos, n) { this.moveTo(pos + n); for (let i = 0; i < n && this.gs > 0; i++) this.buf[--this.gs] = null; }
  text() { return this.buf.slice(0, this.gs).join("") + this.buf.slice(this.ge).join(""); }
}

/** Piece table (VS Code, Word): the original file is never modified; new text is appended to an add buffer; a list of pieces stitches them. */
export class PieceTable {
  constructor(text = "") { this.orig = text; this.add = ""; this.pieces = text ? [{ src: "orig", start: 0, len: text.length }] : []; this.moved = 0; }
  #split(pos) { // ensure a piece boundary at pos; returns index of the piece starting there
    let off = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (pos === off) return i;
      if (pos < off + p.len) { const k = pos - off; this.pieces.splice(i, 1, { ...p, len: k }, { src: p.src, start: p.start + k, len: p.len - k }); return i + 1; }
      off += p.len;
    }
    return this.pieces.length;
  }
  insert(pos, s) {
    if (!s) return;
    // typing at the end of the last-added piece just extends it
    let off = 0; for (const p of this.pieces) { off += p.len; if (off === pos && p.src === "add" && p.start + p.len === this.add.length) { this.add += s; p.len += s.length; return; } if (off > pos) break; }
    const i = this.#split(pos); this.pieces.splice(i, 0, { src: "add", start: this.add.length, len: s.length }); this.add += s;
  }
  remove(pos, n) { const i = this.#split(pos), j = this.#split(pos + n); this.pieces.splice(i, j - i); }
  text() { return this.pieces.map(p => (p.src === "orig" ? this.orig : this.add).substr(p.start, p.len)).join(""); }
}
