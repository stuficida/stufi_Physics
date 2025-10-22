// [빌립보서 4장 13절] 내게 능력 주시는 자 안에서 모든 것을 할 수 있다.

// key Mapper
Input.keyMapper[87] = 'w';    // W 키를 위쪽 이동에 매핑
Input.keyMapper[65] = 'a';  // A 키를 왼쪽 이동에 매핑
Input.keyMapper[83] = 's';  // S 키를 아래쪽 이동에 매핑
Input.keyMapper[68] = 'd'; // D 키를 오른쪽 이동에 매핑

const FPS = 60;

const { sqrt, sign, abs, round, floor, ceil, trunc, sin, cos, tan, asin, acos, atan, min, max } = Math;
const { PI, E, SQRT2 } = Math;

function clamp(v, m, M) { return max(min(v, M), m); }

const s_VECTOR = { // 2D vector([x, y])'s util
    add(a, b) { return a.map((v, i) => v + b[i]); },
    sub(a, b) { return a.map((v, i) => v - b[i]); },
    scale(v, c) { return v.map(v => v * c); },

    dot(a, b) { return a.reduce((result, v, i) => result + v * b[i], 0); },
    cross(a, b) { return a[0] * b[1] - a[1] * b[0]; },

    length(v) { return Math.hypot(...v); },
    normalize(v) { return s_VECTOR.scale(v, 1 / s_VECTOR.length(v)); },

    normal(v) { return s_VECTOR.normalize([-v[1], v[0]]); },
    proj(v, axis) { return s_VECTOR.scale(axis, s_VECTOR.dot(v, axis) / s_VECTOR.dot(axis, axis)); },

    rotate(v, angle) { return [v[0] * cos(angle) - v[1] * sin(angle), v[0] * sin(angle) + v[1] * cos(angle)]; },
};

const { add, sub, scale, dot, cross, length, normalize, normal, proj, rotate } = s_VECTOR;

Array.prototype.add = function(v) { return add(this, v); };
Array.prototype.sub = function(v) { return sub(this, v); };
Array.prototype.scale = function(c) { return scale(this, c); };

//////////////////////////////////////////////////

const destroyed_events = new Map();

class s_Object {
// static
    static saved = {};

    static #player = null;
    static #list = new Set();
    static get list() { return this.#list; }

    static find(id) {
        if(id instanceof Game_Character) {
            if(id === $gamePlayer) id = 'p';
            else id = id._eventId;
        }

        for(let obj of this.list.values()) { if(obj.id === id) return obj; }
        return null;
    }

    static find_by_tag(tag) {
        const result = [];
        for(let o of this.#list) {
            if(o.tags.has(tag)) result.push(o);
        }

        return result;
    }

    static types = {
        // can_move, can_rotate, can_collide, can_physics
        object: [true, true, true, true],
        block: [false, false, true, true],
        collision: [false, true, true, false]
    };

    static get player() { return this.#player; }
    static get has_player() { return !!this.#player; }

    static save() {
        const s_objs = [];
        s_Object.list.forEach(o => {
            if(o instanceof s_Block || o instanceof s_TmpObject) return;
            const obj = {
                id: o.id,
                hitbox: o.hitbox,
                loc: o.loc, angle: o.angle,
                tags: [...o.tags],
                
                c_ignore: {
                    objs: [...o.c_ignore.objs].map(o => o.id).filter(o => typeof o.id !== 'string' || o.id[0] !== 's'),
                    types: this.to_save_value(o.c_ignore.types),
                },

                type: o.type,

                
                physics: o.physics,
            };

            for(let k in o) {
                if(k !== 'hitbox' && k !== 'loc' && k !== 'angle' && k !== 'tags' && k !== 'c_ignore')
                    obj[k] = this.to_save_value(o[k]);
            }

            s_objs.push(obj);
        });

        if(s_objs.length === 0) return;

        const s_joints = [];
        s_Joint.list.forEach(j => {
            const joint = {
                a: j.a.id, b: j.b.id,
                pa: j.pa, pb: j.pb,
                length: j.length,
                nf: j.nf, zetta: j.zetta,
                name: j.name,
            };

            s_joints.push(joint);
        });

        this.saved[$gameMap._mapId] = { s_objs, s_joints, finished: false };
        console.log("saved:", this.saved);
    }

    static to_save_value(v) {
        if(v instanceof s_Object) {
            return { type: "s_obj", value: v.id };
        } else if(v instanceof s_Joint) {
            return { type: "s_joint", value: v.name };
        } /* else if(v instanceof s_AnimHelper) {
            let value = [];
            for(let key in v) value[key] = v[key];
            return { type: "s_anim_helper", value: { obj: v.obj.id, img: v.img, status: v.status } };
        } */ else if(v instanceof Set) {
            let result = [];
            for(let i of v) result.push(this.to_save_value(i));
            return { type: 'set', value: result };
        } else if(v instanceof Map) {
            let result = [];
            for(let [key, value] of v) {
                result.push([key, this.to_save_value(value)]);
            }

            return {type: 'map', value: result };
        } else if(Array.isArray(v)) {
            let result = [];
            for(let i of v) result.push(this.to_save_value(i));
            return result;
        } else if(typeof v === 'object') {
            let result = {};
            for(let i in v) {
                result[i] = this.to_save_value(v[i]);
            }
        } else {
            return v;
        }
    }

    static saved_s_value(v) {
        if(v && typeof v === 'object') {
            if(v.type === 's_obj') {
                return s_Object.find(v.value);
            } else if(v.type === 's_joint') {
                return s_Joint.find(v.value);
            } else if(v.type === 'set') {
                const arr = v.value.map(v => this.saved_s_value(v));
                return new Set(arr);
            } else if(v.type === 'map') {
                const arr = [];
                for(let [key, value] of v.value) {
                    arr.push([key, this.saved_s_value(value)]);
                }

                return new Map(arr);
            }

            let obj = {};
            for(let key in v) {
                obj[key] = this.saved_s_value(v[key]);
            }

            return obj;
        }

        return v;
    }

// private
    #obj = null; #id = -1; // id: event: eventID, block: 'b' + regionID, player: 'p'
    #sprite = null;

    #hitbox = [0, 0];
    #c_objs = new Set(); // collied objs
    
    #loc = [0, 0]; #p_loc = [0, 0]; #z = 1;
    #angle = 0; #p_angle = 0;

    #events = {
        start: () => { this.start(); }, 
        end: () => { this.end(); },
        tick: () => { this.tick() },
        collied_in: (obj, collision) => { this.collied_in(obj, collision) },
        collied_out: (obj) => { this.collied_out(obj); },
    };

    #physics = null;

// public
    can_move = true; can_rotate = true;
    can_collide = true;
    can_physics = true;

    type = 'object';
    tags = new Set();

    c_ignore = {
        objs: new Set(),
        types: new Set(),
        // tags: new Set(),
    };

    use_anim = false;

// get
    get obj() { return this.#obj; } get id() { return this.#id; }
    get sprite() { return this.#sprite; }

    get hitbox() { return [...this.#hitbox]; }
    get w() { return this.#hitbox[0]; } get h() { return this.#hitbox[1]; }
    get c_objs() { return this.#c_objs; }

    get loc() { return [...this.#loc]; }
    get x() { return this.#loc[0]; } get y() { return this.#loc[1]; }
    get z() { return this.#z; }

    get angle() { return this.#angle; }
    get angle_rad() { return this.#angle / 180 * Math.PI; } // degree > radian

    get events() { return this.#events; }

    get physics() { return this.#physics; } get p() { return this.#physics; }

// get utils
    get axis() { return [cos(this.angle_rad), sin(this.angle_rad)]; }
    get forward_vector() {
        if(!this.#obj) return this.axis;
        
        if(this.#obj._direction === 6) return this.axis; 
        if(this.#obj._direction === 4) return scale(this.axis, -1);
        if(this.#obj._direction === 8) return normal(this.axis);
        if(this.#obj._direction === 2) return normal(this.axis).scale(-1);
    }

    get vertices() {
        const hw = this.w / 2, hh = this.h / 2;
        const l = this.#loc;
        const axis = this.axis, axis_t = normal(axis);

        return [ // rt, lt, lb, rb
            add(l, scale(axis, hw).add(scale(axis_t, -hh))),
            add(l, scale(axis, -hw).add(scale(axis_t, -hh))),
            add(l, scale(axis, -hw).add(scale(axis_t, hh))),
            add(l, scale(axis, hw).add(scale(axis_t, hh))),
        ];
    }

    get normals() { return this.vertices.map((p, i, v) => normal(sub(v[(i + 1) % 4], p))); }

    get is_falling() { 
        const floor = s_COLLIDER.line_trace(this.#loc, add(this.#loc, [0, this.h / 2 + 0.005]), new Set([this]), true);
        return !floor.hit;
    }

// set
    set id(id) { this.#id = id; }

    set sprite(s) {
        if(s instanceof Sprite_Character) this.#sprite = s;
    }

    set w(w) { this.#hitbox[0] = w; } set h(h) { this.#hitbox[1] = h; }
    set hitbox(h) { this.w = h[0]; this.h = h[1]; }
    
    set x(x) {
        // if(!this.can_move) return;
        this.#p_loc[0] = this.#loc[0];
        this.#loc[0] = x;
        if(this.#obj) this.#obj._x = this.#obj._realX = x - 0.5;
    }

    set y(y) {
        // if(!this.can_move) return;
        this.#p_loc[1] = this.#loc[1];
        this.#loc[1] = y;
        if(this.#obj) this.#obj._y = this.#obj._realY = y - 0.5;
    }

    set z(z) { this.#z = z; }

    set loc(l) { this.x = l[0]; this.y = l[1]; }

    set angle(a) {
        this.#p_angle = this.#angle;
        this.#angle = a;

        if(this.#obj) {
            try { this.#sprite.angle = a; }
            catch(e) {}
        }
    }

    set angle_rad(a_rad) { this.angle = a_rad / Math.PI * 180; }

//////////////////////////////////////////////////

    constructor(obj, hitbox = [0, 0], type = 'object') {
        if(typeof obj === 'number') this.#id = obj, obj = $gameMap.event(obj);
        else if(typeof obj === 'string' && obj[0] === 'b') this.#id = obj, obj = null;
        else if(obj === $gamePlayer) this.#id = 'p', s_Object.#player = this;
        else if(obj instanceof Game_Event) this.#id = obj._eventId;
        else if(this instanceof s_TmpObject) this.#id = obj.id;

        this.#hitbox[0] = hitbox[0]; this.#hitbox[1] = hitbox[1];

        if(this.#obj = obj) {
            this.renew_sprite(true);

            this.#loc[0] = this.#p_loc[0] = this.#obj._realX + 0.5;
            this.#loc[1] = this.#p_loc[1] = this.#obj._realY + 0.5;
            this.#angle = this.#p_angle = this.#sprite.angle;

            const that = this;
            const _updateAnimationCount = this.obj.updateAnimationCount;
            this.obj.updateAnimationCount = function() {
                if(that.use_anim) ++this._animationCount;
                else _updateAnimationCount.call(this);
            };

            const _updatePattern = this.obj.updatePattern;
            this.obj.updatePattern = function() {
                // this._pattern = (this._pattern + 1) % this.maxPattern();
                if(that.use_anim) this._pattern = (this._pattern + 1) % (this._cframes + this._spattern);
                else _updatePattern.call(this);
            };

            const _set_direction = obj.setDirection;
            this.obj.setDirection = function(dir) {
                _set_direction.call(this, dir);
            }
        }

        this.type = type;
        if(type = s_Object.types[type]) {
            this.can_move = type[0]; this.can_rotate = type[1];
            this.can_collide = type[2];
            this.can_physics = type[3];
        }

        if(this.#id === 'p') this.#z = 10;

        this.#physics = new s_Physics(this);
        
        const save = s_Object.saved[$gameMap._mapId];
        if(save && typeof this.id === 'number') {
            let updated = false;
            for(let o of save.s_objs) {
                if(o.id === this.id) {
                    this.hitbox = o.hitbox;
                    this.loc = o.loc; this.angle = o.angle;
                    this.tags = new Set(o.tags);
                    this.type = o.type;

                    for(let k in o.physics) {
                        if(Array.isArray(o.physics[k])) {
                            for(let i = 0; i < o.physics[k].length; ++i) {
                                this.#physics[k][i] = o.physics[k][i] !== null ? o.physics[k][i] : Infinity;
                            }
                        } else {
                            this.#physics[k] = o.physics[k] !== null ? o.physics[k] : Infinity;
                        }
                    }

                    for(let k in o.c_ignore.types) {
                        this.c_ignore.types.add(k);
                    }

                    updated = true;
                    break;
                }
            }

            if(!updated) {
                this.destroy();
                return;
            }
        }

        if(type === 'collision') this.#physics.m = 0;        

        s_Object.list.add(this);
        this.#events.start();
    }

    renew_sprite(initialize = false) {
        if(!this.#obj) return false;
        
        if(this instanceof s_TmpObject) {
            this.#sprite = new Sprite_Character(this.#obj);
            SceneManager._scene._spriteset.addChild(this.#sprite);
        } else {
            this.#sprite = SceneManager._scene._spriteset
                ._characterSprites.find(sprite => sprite._character === this.#obj);
        }

        this.#sprite.updatePosition = () => {
            const s = this.#sprite;

            if(this.w < 1) s.anchor._x = this.w / 2;
            else s.anchor._x = 0.5;
            s.x = (this.x - $gameMap._displayX) * $gameMap.tileWidth();

            if(this.h < 1) s.anchor._y = this.h / 2;
            else s.anchor._y = 0.5;
            s.y = (this.y - $gameMap._displayY) * $gameMap.tileHeight();

            s.z = this.z;
        };

        if(!initialize) this.#sprite.angle = this.#angle;
        return true;
    }

    update() {
        this.#physics.update();
        this.#events.tick();
    }

    destroy() {
        this.#events.end();
        if(this.#obj) this.#obj.setImage("");
        if(this.#obj && this.#id !== 'p') this.#obj.erase();
        s_Object.list.delete(this);

        if(typeof this.id === 'number') $gameSelfSwitches.setValue([$gameMap._mapId, this.id, 'A'], false);
        else if(this.id === 'p') $gameSelfSwitches.setValue([$gameMap._mapId, this._id, 'A'], false);

        if(!destroyed_events.has($gameMap._mapId)) destroyed_events.set($gameMap._mapId, new Set());
        if(typeof this.id === 'number') destroyed_events.get($gameMap._mapId).add(this.id);
    }

    // user custom event(implement)
    start() {} end() {}
    tick() {}
    collied_in(obj, collision) {} collied_out(obj) {}
}

class s_Block extends s_Object {
    constructor(regionID, start, end = start) {
        const extent = sub(end, start);
        const w = abs(extent[0]) + 1, h = abs(extent[1]) + 1;

        super('b' + regionID, [w, h], 'block');

        const l = add(start, end).scale(0.5);
        this.x = l[0] + 0.5; this.y = l[1] + 0.5;

        this.physics.m = Infinity;
    }
}

class s_TmpObject extends s_Object {
    static id = 0;

    constructor(img, hitbox = [1, 1], loc = [0, 0], type = 'object', id) {
        const obj = new Game_Character();
        
        if(id) {
            obj.id = id;
            s_TmpObject.id = max(parseInt(id.slice(1)) + 1, s_TmpObject.id);
        } else {
            obj.id = 's' + s_TmpObject.id++;
        }

        super(obj, hitbox, type);
        
        if(img) obj.setImage(img, 0);
        this.loc = loc;
    }

    update() {
        super.update();
        this.sprite._character.update();
        this.sprite.update();
    }
}

//////////////////////////////////////////////////

const s_COLLIDER = {
    AABB(a, b) {
        const va = a.vertices, vb = b.vertices;

        let min_a = [Infinity, Infinity], max_a = [-Infinity, -Infinity];
        let min_b = [Infinity, Infinity], max_b = [-Infinity, -Infinity];

        va.forEach(v => {
            min_a[0] = min(v[0], min_a[0]); min_a[1] = min(v[1], min_a[1]);
            max_a[0] = max(v[0], max_a[0]); max_a[1] = max(v[1], max_a[1]);
        });

        vb.forEach(v => {
            min_b[0] = min(v[0], min_b[0]); min_b[1] = min(v[1], min_b[1]);
            max_b[0] = max(v[0], max_b[0]); max_b[1] = max(v[1], max_b[1]);
        });

        return (min_a[0] <= max_b[0]) && (max_a[0] >= min_b[0])
            && (min_a[1] <= max_b[1]) && (max_a[1] >= min_b[1]);
    },

    mM_on_axis(pts, axis) {
        axis = normalize(axis);
        const d = pts.map(p => dot(p, axis));
        return { min: min(...d), max: max(...d) };
    },

    SAT(a, b) {
        const axes_a = a.normals, axes_b = b.normals;
        const axes = [...axes_a, ...axes_b];
        const va = a.vertices, vb = b.vertices;

        let min_pen = Infinity, min_axis = null;
        let ref = null, face_i = -1;
        for(let i = 0; i < axes.length; ++i) {
            const axis = axes[i];
            const mM_a = this.mM_on_axis(va, axis), mM_b = this.mM_on_axis(vb, axis);
            
            const pen = min(mM_a.max, mM_b.max) - max(mM_a.min, mM_b.min);
            if(pen < Number.EPSILON) return false;
            if(pen < min_pen) {
                min_pen = pen; min_axis = axis;
                ref = i < axes_a.length ? a : b;
                face_i = i < axes_a.length ? i : i - axes_a.length;
            }
        }

        const inc = ref === a ? b : a;
        const s = sign(dot(sub(inc.loc, ref.loc), min_axis));
        return { ref, inc, face_i, n: scale(min_axis, s), pen: min_pen };
    },

    clip(line, n, d) {
        if(line.length !== 2) return line;
        const result = [];

        const d0 = d - dot(line[0], n);
        if(d0 >= 0) result.push(line[0]);
        const d1 = d - dot(line[1], n);
        if(d1 >= 0) result.push(line[1]);

        if(d0 * d1 < 0) {
            const t = d0 / (d0 - d1);
            const p = add(line[0], scale(sub(line[1], line[0]), t));
            result.push(p);
        }

        return result;
    },

    face_ref(ref, n_ref) {
        const n = n_ref, nt = normal(n);
        
        let d, dt;
        if(abs(dot(ref.axis, n)) > abs(dot(ref.axis, nt))) d = ref.w / 2, dt = ref.h / 2;
        else d = ref.h / 2, dt = ref.w / 2;

        const face = add(ref.loc, scale(n, d));
        const line = [add(face, scale(nt, dt)), add(face, scale(nt, -dt))];
        return { face, line };
    },

    face_inc(inc, n_ref) {
        let min_d = Infinity, min_n = null;
        let face_i = -1;

        const n_inc = inc.normals;
        for(let i = 0; i < n_inc.length; ++i) {
            const n = n_inc[i];
            const d = dot(n, n_ref);
            if(d < min_d) min_d = d, min_n = n, face_i = i;
        }

        const n = min_n, nt = normal(n);
        
        let d, dt;
        if(abs(dot(inc.axis, n)) > abs(dot(inc.axis, nt))) d = inc.w / 2, dt = inc.h / 2; 
        else d = inc.h / 2, dt = inc.w / 2;

        const face = add(inc.loc, scale(n, d));
        const line = [add(face, scale(nt, -dt)), add(face, scale(nt, dt))];

        return { face, face_i, line, n };
    },

    sort_dir(line, axis) {
        const e = normalize(sub(axis[1], axis[0]));
        line.sort((a, b) => {
            const ta = dot(sub(a, axis[0]), e);
            const tb = dot(sub(b, axis[0]), e);
            return ta - tb;
        });
    },

    check(a, b) {
        if(!a.can_collide || !b.can_collide) return false;
        if(a.c_ignore.objs.has(b) || a.c_ignore.types.has(b.type)) return false;
        if(b.c_ignore.objs.has(a) || b.c_ignore.types.has(a.type)) return false;

        if(!this.AABB(a, b)) return false;

        const SAT = this.SAT(a, b);
        if(!SAT) return false;

        const ref = SAT.ref, inc = SAT.inc;
        const n = SAT.n, nt = normal(n);
        const f_ref = this.face_ref(ref, n), f_inc = this.face_inc(inc, n);

        let line = [...f_inc.line];

        { // 1차, 2차 클리핑
            const d = dot(f_ref.line[0], nt);
            line = this.clip(line, nt, d);
            if(line.length < 2) return false;
        } {
            const nt_r = scale(nt, -1);
            const d = dot(f_ref.line[1], nt_r);
            line = this.clip(line, nt_r, d);
            if(line.length < 2) return false;
        }

        const d = dot(f_ref.face, n);
        // line = this.clip(line, n, d);
        for(let i = 1; i >= 0; --i) {
            const pen = d - dot(line[i], n);
            if(pen < 0) {
                line.splice(i, 1);
                continue;
            }

            line[i].corr = add(line[i], scale(n, pen));
            line[i].pen = pen;
        }

        if(line.length === 0) return false;
        if(line.length === 2) {
            this.sort_dir(line, f_inc.line);
        }

        return { ref, inc, SAT, line, f_ref, f_inc, fi_ref: SAT.face_i, fi_inc: f_inc.face_i };
    },

    call_event(a, b, collision) {
        if(collision) {
            if(!a.c_objs.has(b) && !b.c_objs.has(a)) {
                a.c_objs.add(b); b.c_objs.add(a);
                a.events.collied_in(b, collision);
                b.events.collied_in(a, collision);
            }
        } else if(a.c_objs.has(b) && b.c_objs.has(a)) {
            a.c_objs.delete(b); b.c_objs.delete(a);
            a.events.collied_out(b);
            b.events.collied_out(a);
        }
    },

    line_trace(start, end, ignore_objs, debug_line = false) {
        const extent = sub(end, start);
        const d = normalize(extent);
        const distance = length(extent);
        
        extent[0] = abs(extent[0]); extent[1] = abs(extent[1]);
        const min_x = min(start[0], end[0]), min_y = min(start[1], end[1]);
        const max_x = max(start[0], end[0]), max_y = max(start[1], end[1]);
        const vertices = [[max_x, min_y], [min_x, min_y], [min_x, max_y], [max_x, max_y]];

        const dummy = {
            w: extent[0], h: extent[1],
            vertices,
            normals: vertices.map((p, i, v) => normal(sub(v[(i + 1) % 4], p))),
        };

        const objs = new Set();
        for(let o of s_Object.list) {
            if(o.type !== 'object' && o.type !== 'block') continue;
            if(this.AABB(o, dummy))
                if(!ignore_objs || !ignore_objs.has(o))
                    objs.add(o);
        }

        let min_t = distance, min_obj = null, min_normal = null;

        for(let o of objs) {
            const vertices = o.vertices;
            for(let i = 0; i < vertices.length; ++i) {
                const v = sub(vertices[(i + 1) % 4], vertices[i]);
                const den = cross(d, v);

                const w = sub(vertices[i], start);
                
                const t = cross(w, v) / den;
                const u = cross(w, d) / den;
                if((t >= 0 && t <= distance) && (u >= 0 && u <= 1)) {
                    if(t < min_t) min_t = t, min_obj = o, min_normal = normal(v);
                }
            }
        }

        const hit = distance - min_t > Number.EPSILON;
        const p_hit = add(start, scale(d, min_t));
        let length_hit = -1, normal_hit = null;
        if(hit) {
            length_hit = length(sub(p_hit, start));
            normal_hit = scale(min_normal, sign(dot(min_normal, scale(d, -1))));
        }

        if(debug_line) {
            const line = new PIXI.Graphics();
            line.lineStyle(4, 0xff0000);
            line.moveTo((start[0] - $gameMap._displayX) * $gameMap.tileWidth(), (start[1] - $gameMap._displayY) * $gameMap.tileHeight());
            line.lineTo((p_hit[0] - $gameMap._displayX) * $gameMap.tileWidth(), (p_hit[1] - $gameMap._displayY) * $gameMap.tileHeight());

            if(hit) {
                line.lineStyle(5, 0x00ff00);
                line.moveTo((p_hit[0] - $gameMap._displayX) * $gameMap.tileWidth(), (p_hit[1] - $gameMap._displayY) * $gameMap.tileHeight());
                line.lineTo((end[0] - $gameMap._displayX) * $gameMap.tileWidth(), (end[1] - $gameMap._displayY) * $gameMap.tileHeight());
            }

            SceneManager._scene.addChild(line);
            requestAnimationFrame(() => {
                SceneManager._scene.removeChild(line);
                line.destroy();
            });
        }

        return { hit, p_hit, length_hit, normal_hit };
    }
};

//////////////////////////////////////////////////

class s_Physics {
// private
    #obj = null;
    
//public
    m = 1;

    a = [0, 9.81]; // acceleration
    min_a = [0, 0]; max_a = [Infinity, Infinity]; // limit
    v = [0, 0]; // velocity
    min_v = [0, 0]; max_v = [Infinity, Infinity];
    w = 0; // angular velocity
    min_w = 0; max_w = Infinity;

    e = 0.6; // elastic
    u = 0.4; // friction

// get utils
    get I() { return this.m * (this.#obj.w ** 2 + this.#obj.h ** 2) / 12; }

//////////////////////////////////////////////////

    constructor(obj) { this.#obj = obj; }

    check_limit(a = true, v = true, w = true) {
        if(a) {
            this.a[0] = sign(this.a[0]) * clamp(abs(this.a[0]), this.min_a[0], this.max_a[0]);
            this.a[1] = sign(this.a[1]) * clamp(abs(this.a[1]), this.min_a[1], this.max_a[1]);
        }

        if(v) {
            this.v[0] = sign(this.v[0]) * clamp(abs(this.v[0]), this.min_v[0], this.max_v[0]);
            this.v[1] = sign(this.v[1]) * clamp(abs(this.v[1]), this.min_v[1], this.max_v[1]);
        }

        if(w) this.w = sign(this.w) * clamp(abs(this.w), this.min_w, this.max_w);
    }

    force(f, p = this.#obj.loc) {
        if(this.m === Infinity || this.m === 0) return;

        if(this.#obj.can_move) {
            this.v[0] += f[0] / this.m;
            this.v[1] += f[1] / this.m;
        }

        if(this.#obj.can_rotate) this.w += cross(sub(p, this.#obj.loc), f) / this.I;
        this.check_limit(false);
    }

    force_rel(f, p = [0, 0]) { this.force(f, add(p, this.#obj.loc)); }

    update() {
        if(this.#obj.can_move) {
            this.#obj.x += this.v[0] / FPS;
            this.#obj.y += this.v[1] / FPS;
        }

        if(this.#obj.can_rotate) this.#obj.angle_rad += this.w / FPS;
    }

    static impulse(c, beta = 0.2, pen_ok = 0.005) {
        const { ref: a, inc: b, SAT, line } = c;
        const n = SAT.n, nt = normal(n);

        const _e = Math.max(a.p.e, b.p.e);
        const u = sqrt(a.p.u * b.p.u);
        
        for(let p of line) {
            // const ra = sub(p, a.loc), rb = sub(p, b.loc);
            { // impulse
                const va = add(a.p.v, [-p.ra[1] * a.p.w, p.ra[0] * a.p.w]);
                const vb = add(b.p.v, [-p.rb[1] * b.p.w, p.rb[0] * b.p.w]);
                const v = sub(vb, va);

                const bias = 0;
                const e = -dot(n, v) > 0.5 ? _e : 0;
                let jn = -((1 + e) * dot(n, v) - bias) / p.N;

                jn = max(p._jn + jn, 0) - p._jn;
                jn = max(jn, 0);
                p._jn += jn;

                a.p.force(scale(n, -jn), p);
                b.p.force(scale(n, jn), p);
            }  { // friction
                const va = add(a.p.v, [-p.ra[1] * a.p.w, p.ra[0] * a.p.w]);
                const vb = add(b.p.v, [-p.rb[1] * b.p.w, p.rb[0] * b.p.w]);
                const v = sub(vb, va);

                let jt = -dot(v, nt) / p.T;
                jt = clamp(p._jt + jt, -u * abs(p._jn), u * abs(p._jn)) - p._jt;
                p._jt += jt;

                a.p.force(scale(nt, -jt), p);
                b.p.force(scale(nt, jt), p);
            }
        }
    }

    static #p_collisions = new Set();
    static update(beta = 0.2, pen_ok = 0.005, gamma = 0.9) {
        s_Object.list.forEach(o => {
            if(o.p.m !== Infinity)
                o.p.force(scale(o.p.a, 1 / FPS * o.p.m));
        });
        
        const collisions = new Set();
        const objs = [...s_Object.list];
        for(let i = 0; i < objs.length; ++i) {
            const a = objs[i];
            for(let j = i + 1; j < objs.length; ++j) {
                const b = objs[j];
                if(a.p.m === Infinity && b.p.m === Infinity) continue;
                
                const c = s_COLLIDER.check(a, b);
                s_COLLIDER.call_event(a, b, c);

                if(c && a.can_physics && b.can_physics) {
                    for(let p of c.line) {
                        const a = c.ref, b = c.inc;

                        const n = c.SAT.n, nt = normal(n);
                        const ra = sub(p, a.loc), rb = sub(p, b.loc);
                        p.ra = ra; p.rb = rb;
                        p.N = (1 / a.p.m) + (1 / b.p.m) + (cross(ra, n) ** 2 / a.p.I) + (cross(rb, n) ** 2 / b.p.I);
                        p.T = (1 / a.p.m) + (1 / b.p.m) + (cross(ra, nt) ** 2 / a.p.I) + (cross(rb, nt) ** 2 / b.p.I);
                        p._jn = 0; p._jt = 0;
                    }

                    collisions.add(c);
                }
            }
        }

        s_Joint.list.forEach(j => j.setup());
        // for(let i = 0; i < 1; ++i) 
        s_Joint.list.forEach(j => j.update());

        // warm-start
        for(let pc of this.#p_collisions) {
            for(let c of collisions) {
                if(c.ref !== pc.ref || c.inc !== pc.inc) continue;
                if(pc.fi_ref !== c.fi_ref || pc.fi_inc !== c.fi_inc) continue;
                if(c.line.length !== pc.line.length) continue;

                // s_COLLIDER.sort_dir(pc.line, pc.f_inc.line);
                // s_COLLIDER.sort_dir(c.line, c.f_inc.line);

                const n = c.SAT.n, nt = normal(n);
                for(let i = 0; i < c.line.length; ++i) {
                    if(length(sub(pc.line[i], c.line[i])) > Number.EPSILON) continue;

                    c.line[i]._jn = (pc.line[i]._jn || 0) * gamma;
                    c.ref.p.force(scale(n, -c.line[i]._jn), c.line[i]);
                    c.inc.p.force(scale(n, c.line[i]._jn), c.line[i]);

                    c.line[i]._jt = (pc.line[i]._jt || 0) * gamma;
                    c.ref.p.force(scale(nt, -c.line[i]._jt), c.line[i]);
                    c.inc.p.force(scale(nt, c.line[i]._jt), c.line[i]);
                }

                break;
            }
        }

        this.#p_collisions = collisions;

        for(let i = 0; i < 10; ++i) collisions.forEach(c => this.impulse(c, beta, pen_ok));
        collisions.forEach(c => {
            const { ref: a, inc: b, SAT, line } = c;
            const n = SAT.n;
            const r = (1 / a.p.m) + (1 / b.p.m);
            for(let p of line) {
                if(p.pen > pen_ok) {
                    const c = beta * max(p.pen - pen_ok, 0);
                    a.x -= c * n[0] * (1 / a.p.m) / r;
                    a.y -= c * n[1] * (1 / a.p.m) / r;
                    b.x += c * n[0] * (1 / b.p.m) / r;
                    b.y += c * n[1] * (1 / b.p.m) / r;
                }
            }
        });
    }
}

class s_Joint {
// static
    static list = new Set();

    static find(name) {
        for(let j of this.list) {
            if(j.name === name) return j;
        }
    }

// private
    #a = null; #b = null; // target_obj
    #point_a = [0, 0]; #point_b = [0, 0]; // Joint를 연결할 상대 위치
    
    #_acc = 0;
    #n = 0;
    #K = 0; #bias = 0; #gamma = 0;

// public
    name = "";
    
    length = 0;
    nf = 0; zetta = 0.7;

// get
    get a() { return this.#a; } get b() { return this.#b; }
    get pa() { return this.#point_a; } get pb() { return this.#point_b; }

    constructor(a, b, length = 0, nf = 0, zetta = 0.7, point_a = [0, 0], point_b = [0, 0], name) {
        this.name = name;
        this.#a = a; this.#b = b;
        this.#point_a = [...point_a]; this.#point_b = [...point_b];

        this.length = length;
        this.nf = nf; this.zetta = zetta;
        
        if(name) this.name = name;
        else name = s_Joint.list.size;
        
        s_Joint.list.add(this);

        // load saves
    }

    setup(beta = 0.2) {
        const a = this.#a, b = this.#b;
        
        const ra = rotate(this.#point_a, a.angle_rad), rb = rotate(this.#point_b, b.angle_rad);
        const pa = add(ra, a.loc), pb = add(rb, b.loc);

        const C = length(sub(pb, pa)) - this.length;

        const d = sub(pb, pa);
        const n = length(d) > Number.EPSILON ? normalize(d) : [1, 0];
        
        let K = (1 / a.p.m) + (1 / b.p.m) + (cross(ra, n) ** 2 / a.p.I) + (cross(rb, n) ** 2 / b.p.I);
        K = 1 / K;
        
        let bias; let gamma = 0;
        if(this.nf <= 0) {
            bias = beta * C * FPS;
        } else {  // 스프링
            const w = 2 * Math.PI * this.nf;
            gamma = (2 * K * w * this.zetta / FPS) + (K * (w ** 2) / (FPS ** 2));
            bias = K * (w ** 2) * C / FPS;

            K = 1 / (1 / K + gamma);
        }

        const J = scale(n, this.#_acc);
        a.p.v[0] -= J[0] / a.p.m; a.p.v[1] -= J[1] / a.p.m;
        a.p.w -= cross(ra, J) / a.p.m;

        b.p.v[0] += J[0] / b.p.m; b.p.v[1] += J[1] / b.p.m;
        b.p.w += cross(rb, J) / b.p.m;
        
        this.#n = n;
        this.#K = K; this.#bias = bias; this.#gamma = gamma;
    }

    update() {
        const a = this.#a, b = this.#b;
        const ra = rotate(this.#point_a, a.angle_rad), rb = rotate(this.#point_b, b.angle_rad);

        const va = add(a.p.v, [-ra[1] * a.p.w, ra[0] * a.p.w]);
        const vb = add(b.p.v, [-rb[1] * b.p.w, rb[0] * b.p.w]);
        const vn = dot(this.#n, sub(vb, va));

        const rhs = vn + this.#bias + this.#gamma * this.#_acc;
        let d_lambda = -this.#K * rhs;

        this.#_acc += d_lambda;
        
        const J = scale(this.#n, d_lambda);
        a.p.force_rel(scale(J, -1), ra);
        b.p.force_rel(J, rb);
    }

    destroy() { s_Joint.list.delete(this); }

    static destroy(name) {
        for(let j of s_Joint.list) {
            if(j.name === name) {
                s_Joint.list.delete(j);
                break;
            }
        }
    }
}

//////////////////////////////////////////////////

let need_blocks = false;
function search_blocks() {
    const blocks = {};
    for(let x = 0; x < $gameMap.width(); ++x) {
        for(let y = 0; y < $gameMap.height(); ++y) {
            const id = $gameMap.regionId(x, y);
            if(!id) continue;
            if(blocks[id] === undefined) blocks[id] = [[x, y]];
            else blocks[id].push([x, y]);
        }
    }

    for(let b in blocks) new s_Block(b, ...blocks[b]);
    need_blocks = false;
}

const _moveByInput = Game_Player.prototype.moveByInput;
Game_Player.prototype.moveByInput = function() {
    if(!s_Object.has_player) _moveByInput.call(this);
};

// Global start(map loaded) 
let prev_mapID = 0;
const _setup = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId) {
    console.log("als;dfjasldfk");
    s_Controller.list.clear();

    if(prev_mapID) s_Object.list.forEach(o => {
        const id = o.id === 'p' ? o._id : o.id;
        const key = [prev_mapID, id, 'A'];
        $gameSelfSwitches.setValue(key, false);
    });
    s_Object.list.clear();
    _setup.call(this, mapId);

    search_blocks();
    prev_mapID = $gameMap._mapId;
};

// 멈춤 -> 다시 시작
const _start = Scene_Map.prototype.start;
Scene_Map.prototype.start = function() {
    _start.call(this);
    if(need_blocks) search_blocks();
    s_Object.list.forEach(o => o.renew_sprite());
};

// global tick
const _update = Game_Map.prototype.update;
Game_Map.prototype.update = function(sceneActive) {
    _update.call(this, sceneActive);

    // load remaining saves
    const save = s_Object.saved[$gameMap._mapId];
    if(save && !save.finished && s_Object.find(save.s_objs[0].id)) {
        for(let j of save.s_joints) {
            const a = s_Object.find(j.a), b = s_Object.find(j.b);
            if(a && b) new s_Joint(a, b, j.length, j.nf, j.zetta, j.pa, j.pb, j.name);
        }

        for(let o of save.s_objs) {
            let obj = s_Object.find(o.id);
            for(let key in o) {
                if(key !== 'tags' && key !== 'type' && key !== 'c_ignore') {
                    obj[key] = s_Object.saved_s_value(o[key]);
                }
                
                if(key === 'c_ignore') {
                    obj.c_ignore.objs = new Set(o.c_ignore.objs.map(id => s_Object.find(id)));
                }
            }
        }

        save.finished = true;
        // delete s_Object.saved[$gameMap._mapId];

    }

    s_Controller.list.forEach(c => c.update());
    s_Physics.update();
    s_Object.list.forEach(o => o.update());
    if(main_cam) main_cam.update();

    if(destroyed_events.has($gameMap._mapId))
        destroyed_events.get($gameMap._mapId).forEach(id => $gameMap.event(id).erase());
};

const _title_start = Scene_Title.prototype.start;
Scene_Title.prototype.start = function() {
    destroyed_events.clear();
    s_Object.list.clear();
    s_Controller.list.clear();
    s_Object.saved = {};
    _title_start.call(this);
};

// save
const _Scene_Map_terminate = Scene_Map.prototype.terminate;
Scene_Map.prototype.terminate = function() {
    _Scene_Map_terminate.call(this);
};

const _makeSaveContents = DataManager.makeSaveContents;
DataManager.makeSaveContents = function() {
    const c = _makeSaveContents.call(this);
    s_Object.save();
    c.stufi_saved = s_Object.saved;
    c.stufi_map_width = $gameMap.width(); c.stufi_map_height = $gameMap.height();

    return c;
};

const _extractSaveContents = DataManager.extractSaveContents;
DataManager.extractSaveContents = function(contents) {
    _extractSaveContents.call(this, contents);
    if(contents.stufi_saved) {
        const saved = s_Object.saved = contents.stufi_saved;
        for(let s in saved) {
            const mapID = s;
            for(let o of saved[s].s_objs) {
                const id = o.id !== 'p' ? o.id : o._id;
                const key = [mapID, id, 'A'];
                $gameSelfSwitches.setValue(key, false);
            }
        }
    }

    need_blocks = true;
    prev_mapID = $gameMap._mapId;
};