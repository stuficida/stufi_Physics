
const p = new s_Character($gamePlayer, [1.5, 2]);
p._id = this._eventId;
p.controller = new s_Controller(true);
p.max_speed = 8;

p.anim = new s_AnimHelper(p, "knight%(8)", 0);
p.anim.tick = function() {
    const speed = p.speed;
    
    if(p.is_falling) {
        this.img = "knight_fall%(8)";

        if(p.physics.v[1] >= 0) this.update(0);
        else this.update(1);
    } else {
        this.img = "knight%(8)";
        
        if(speed > 0.1) this.update(1);
        else if(!p.is_moving) this.update(0);
    }
};

p.add_Ievent('w', function(type) {
    if(type) { this.jump(); }
    else {
        // stop_jump();
    }
});

p.add_Ievent('d', function(type) {
    if(type === 1) {
        this.add_movement([1, 0], 1);
        this.obj.setDirection(6);
    } else if(type === 0) {

    } else if(type === 2) { // stop_move
        
    } else if(type === 3) { // start_move
        
    }
});

p.add_Ievent('a', function(type) {
    if(type === 1) {
        this.add_movement([-1, 0], 1);
        this.obj.setDirection(4);
    } else if(type === 0) {

    } else if(type === 2) { // stop_move
        
    } else if(type === 3) { // start_move

    }
});

p.add_Ievent('mouse', function(type) {
    if(type === 1) {
        console.log(TouchInput.x);
    } else if(type === 0) {

    } else if(type === 2) {

    } else if(type === 3) {

    }
});

main_cam.target = p;

p.tick = function() {
    p.anim.tick();
};

p.collied_in = function(obj, c) {
    if(obj.tags.has('a')) console.log("충돌함!");
}

p.collied_out = function(obj) {
    if(obj.tags.has('a')) console.log("충돌 끝남!");
}

let o = new s_Object(this._eventId, [3, 3], 'collision');

o.collied_in = function(obj, c) {
if(obj.tags.has('a')) {
$gameMessage.add('박스 인식 완료, 문을 엽니다.');
let door = s_Object.find_by_tag('door')[0];
door.can_move = true;
door.p.v[1] = 0.5;

setTimeout(() => {
door.p.v[1] = 0;
door.can_move = false;
}, 5000);
}
}