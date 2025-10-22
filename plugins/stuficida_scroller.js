class s_Camera {
// private
    #target = null; // follow 모드에서 추격할 대상

    #x = 0; #y = 0;// targetX, targetY
    #_x = 0; #_y = 0; // realX, realY
    
    #_zoom = 1; // real zoom

    #shaker = [];

// public
    power = true; // true: on, false: off
    speed = 1;
    zoom = 1;

// get
    get target() { return this.#target; }
    
    get x() { return this.#x; } get y() { return this.#y; }
    get location() { return [this.#x, this.#y]; }

    // display_location
    get d_x() { return $gameMap._displayX; } get d_y() { return $gameMap._displayY; }
    get d_location() { return [this.d_x, this.d_y]; }

// set
    set target(target) {  if(target instanceof s_Object) this.#target = target; }
    
    set x(x) { this.#x = x; } set y(y) { this.#y = y; }
    set location([x, y]) { this.#x = x; this.#y = y; }

    // display_location
    set d_x(x) { 
        $gameMap._displayX = clamp(x - (Graphics.width / $gameMap.tileWidth()) / 2,
            0, $dataMap.width / 2);
    }

    set d_y(y) {
        $gameMap._displayY = clamp(y - (Graphics.height / $gameMap.tileHeight()) / 2,
            0, $dataMap.height / 2);
    }
    
    set d_location([x, y]) { this.d_x = x; this.d_y = y; }

    /////////////////////////////////////////////////

    constructor(target) {
        if(target instanceof s_Object) {
            this.#target = target;
            this.#x = this.#_x = target.x;
            this.#y = this.#_y = target.y;
        }
    }

    shake(time, power = [1, 1], range = [0.1, 0.1]) {
        this.#shaker.push({ time, power, range });
    }

    update() {
        if(this.#target) {
            this.#x = this.#target.x;
            this.#y = this.#target.y;
        }

        this.#_x += (this.#x - this.#_x) * this.speed;
        this.#_y += (this.#y - this.#_y) * this.speed;

        let max_x = 0, max_y = 0;
        for(let s of this.#shaker) {
            if(s.time <= 0) continue;

            const x = (random() - 0.5) * s.range[0] * s.power[0];
            const y = (random() - 0.5) * s.range[1] * s.power[1];
            if(abs(x) > abs(max_x)) max_x = x;
            if(abs(y) > abs(max_y)) max_y = y;

            s.time -= 1 / FPS;
        }

        for(let i = this.#shaker.length - 1; i >= 0; --i) {
            if(this.#shaker[i].time <= 0) this.#shaker.splice(i, 1);
        }

        this.d_x = this.#_x += max_x; this.d_y = this.#_y += max_y;

        // update zoom
        this.#_zoom += (this.zoom - this.#_zoom) * this.speed;
        $gameScreen.setZoom(this.#_x * $gameMap.tileWidth(), this.#_y * $gameMap.tileHeight(), this.#_zoom);
    }
}

const main_cam = new s_Camera();

const SCROLL_DOWN = Game_Map.prototype.scrollDown;
Game_Map.prototype.scrollDown = function(distance) {
    if(!main_cam || !main_cam.power) SCROLL_DOWN.call(this, distance);
};

const SCROLL_LEFT = Game_Map.prototype.scrollLeft;
Game_Map.prototype.scrollLeft = function(distance) {
    if(!main_cam || !main_cam.power) SCROLL_LEFT.call(this, distance);
};

const SCROLL_RIGHT = Game_Map.prototype.scrollRight;
Game_Map.prototype.scrollRight = function(distance) {
    if(!main_cam || !main_cam.power) SCROLL_RIGHT.call(this, distance);
};

const SCROLL_UP = Game_Map.prototype.scrollUp;
Game_Map.prototype.scrollUp = function(distance) {
    if(!main_cam || !main_cam.power) SCROLL_UP.call(this, distance);
};

//////////////////////////////////////////////////

class s_Controller { // 기본 컨트롤러. 조종자의 입력을 받아 저장
// static
    static list = new Set();

// public
    inputs = new Map(); p_inputs = new Map();
    is_player = false;

    constructor(is_player = false) {
        s_Controller.list.add(this);
        this.is_player = is_player;
    }

    update_input(key, type) {
        if(this.inputs.has(key)) this.p_inputs.set(key, this.inputs.get(key));
        this.inputs.set(key, Number(type));
    }
    
    update() {
        if(this.is_player) {
            for(let k in Input._currentState) {
                if(this.p_inputs.get(k) === 1 && !Input._currentState[k]) { // stop_input
                    this.update_input(k, 2);
                } else if(this.p_inputs.get(k) === 0 && Input._currentState[k]) { // start_input
                    this.update_input(k, 3);
                } else {
                    this.update_input(k, Number(Input._currentState[k]));
                }
            }

            if(TouchInput.isTriggered()) {
                this.update_input("mouse", 3);
            } else if(TouchInput.isReleased()) {
                this.update_input("mouse", 2);
            } else {
                this.update_input("mouse", Number(TouchInput.isPressed()));
            }
        }
    }
};

class s_AI_Controller extends s_Controller {
    constructor() {

    }
}

//////////////////////////////////////////////////

class s_Pawn extends s_Object {
// private
    #Ievents = new Map();

// public
    controller = null;

// get
    get Ievents() { return this.#Ievents; }

    constructor(obj, hitbox = [1, 1]) { super(obj, hitbox); }

    // 입력 이벤트
    add_Ievent(key, event) { this.#Ievents.set(key, event.bind(this)); }
    delete_Ievent(key) { this.#Ievents.delete(key); }

    update() {
        if(this.controller) {
            for(let [key, type] of this.controller.inputs) {
                if(this.#Ievents.has(key)) this.#Ievents.get(key)(type);
            }
        }

        super.update();
    }
}

class s_Character extends s_Pawn {
// private
    #is_moving = false;
    #u = 0;
// public
    accel = 1; decel = 2; // 가속 속도, 감속 배율

    air_control = 1; air_friction = 0;

    max_speed = 5;

    jump_speed = 10; jump_length = 1;
    jump_cnt = 0; max_jump_cnt = 1;

    //////////////////////////////////////////////////

    get is_moving() { return this.#is_moving; }
    get speed() { return length(proj(this.p.v, this.axis)); }

    //////////////////////////////////////////////////

    constructor(obj, hitbox = [1, 1]) {
        super(obj, hitbox);
        if(this.obj) this.obj.setDirection(6);

        this.can_rotate = false;
        this.p.e = 0;
    }

    add_movement(dir, power = 1) { // power: 0 ~ 1
        const v = proj(this.p.v, this.axis);
        const speed = length(v);
        if(speed <= this.max_speed || dot(dir, v) < 0) {
            let d = proj(dir, this.axis).scale(power * this.accel);
            
            const new_v = add(v, d), new_speed = length(new_v);
            if(new_speed > this.max_speed) {
                d = scale(d, abs((new_speed - speed)) / length(d));
            }

            this.p.v[0] += d[0];
            this.p.v[1] += d[1];
            // this.p.force(scale(d, this.p.m));
        }

        this.#is_moving = true;
    }

    jump(ignore_v = false) {
        if(this.jump_cnt >= this.max_jump_cnt) return;
        if(!this.is_falling || this.jump_cnt > 0) {
            if(ignore_v) this.p.v[1] = -this.jump_speed;
            else this.p.force([0, -this.jump_speed]);

            this.jump_cnt += 1;
        }

        this.#is_moving = true;
    }

    update() {
        if(this.controller) {
            for(let [key, type] of this.controller.inputs) {
                if(this.Ievents.has(key)) this.Ievents.get(key)(type);
            }
        }

        const is_falling = this.is_falling;

        if(this.#is_moving) {
            if(this.p.u !== 0) {
                this.#u = this.p.u;
                this.p.u = 0;
            }
        } else if(!is_falling && this.p.u === 0) {
            const v = proj(this.p.v, this.axis);
            const speed = length(v);
            if(speed >= 0) {
                let d = scale(this.axis, this.decel).scale(-sign(dot(this.axis, v)));

                const new_v = add(v, d);
                if(dot(v, new_v) <= 0) {
                    d = scale(v, -1);
                    this.p.u = this.#u;
                }

                this.p.v[0] += d[0];
                this.p.v[1] += d[1];
            } else {
                this.p.u = this.#u;
                this.#is_moving = false;
            }
        }
        
        const p = this.physics;
        if(is_falling) {
            p.v[0] -= p.v[0] * this.air_friction;
            p.v[1] -= p.v[1] * this.air_friction;
        } else {
            this.jump_cnt = 0;
        }

        this.physics.update();
        this.events.tick();

        this.#is_moving = false;
    }
}

class s_AnimHelper { // used at s_Object
    obj = null;
    img = null; status = 0;

    #events = {
        start() {}, end() {},
        tick() {},
    }

    constructor(obj, img, status) {
        this.obj = obj;
        obj.use_anim = true;
        if(img) this.img = img;
        if(typeof status === 'number') this.status = status;

        if(img && typeof status === 'number') obj.obj.setImage(img, status);
    }

    update(status) {
        if(this.status !== status || this._characterName !== this.img) {
            this.obj.obj.setImage(this.img, status);
            this.status = status;
        }
    }

    // implement
    tick() { }
}