This document is translated by ChatGPT.                    
If you find some error on document, tell me.

# 🧩 stufi_Physics.js
**Author:** stuficida
**Purpose:** An open-source project implementing physics in RPG Maker MZ.

---

## 📦 Required External Plugin
> Ensure **`GALV_CharacterFramesMZ.js`** is placed **above** all `stuficida*.js` plugins in the plugin manager.

---

## 📘 Basic Usage Structure
All event scripts must follow this structure:
<img width="1052" height="709" alt="Screenshot 2025-10-23 004158" src="https://github.com/user-attachments/assets/258a2c6e-6abe-4cf5-967c-435a368816fc" />
```
<Script content>
// Must end with:
Control Self Switch: A = ON
```

- Self Switch must **always be A**.  
- It should start **OFF**, and switch to **ON** after the script runs.

---

## 🧱 Class Overview

| Class | Description |
|:--|:--|
| `s_Object` | Attaches to Game_Event to provide movement, rotation, and physics. |
| `s_TmpObject` | Temporary, non-saved object not attached to an event. |
| `s_Block` | Static object generated from region IDs (non-moving, non-rotating). |
| `s_Physics` | Handles physics calculations (forces, torque, inertia, etc). |
| `s_Joint` | Connects two objects like a spring joint. |

---

## 🧩 s_Object

Represents a physical object attached to a `Game_Event` or `Game_Character`.

```js
new s_Object(event, hitbox = [1, 1], type = 'object');
```

| Parameter | Description |
|:--|:--|
| `event` | A `Game_Event` instance or event ID (Number) |
| `hitbox` | `[width, height]` hitbox size |
| `type` | One of `'object'`, `'block'`, `'collision'` |

---

### 🔹 Static Properties

| Property | Description |
|:--|:--|
| `s_Object.list` | List of all s_Object instances on the current map |
| `s_Object.find(id)` | Find s_Object by ID |
| `s_Object.find_by_tag(tag)` | Find s_Object by tag (String) |
| `s_Object.player` | Returns the player’s s_Object |
| `s_Object.has_player` | Checks if player’s s_Object exists |
| `s_Object.save()` | Saves all current s_Objects (auto on save) |

---

### 🔹 Getters

| Name | Description |
|:--|:--|
| `obj` | The attached `Game_Event` or `Game_Character` |
| `id` | Object’s unique ID |
| `vertices` | Returns vertices (RT → LT → LB → RB) |
| `normals` | Returns normals of each edge |
| `is_falling` | Returns whether the object is grounded |

---

### 🔹 Setters

| Method | Description |
|:--|:--|
| `w`, `h`, `hitbox([w,h])` | Set hitbox size |
| `x`, `y`, `loc([x,y])` | Set position |
| `z` | Display order (higher = in front) |
| `angle`, `angle_rad` | Set rotation angle (degrees/radians) |

---

### 🔹 Methods

| Method | Description |
|:--|:--|
| `destroy()` | Removes the object from the map |

---

### 🔹 Event Hooks

| Method | Trigger |
|:--|:--|
| `start()` | On object creation |
| `end()` | On object destruction |
| `tick()` | Called every frame |
| `collied_in(hit_obj, collision)` | When collision begins |
| `collied_out(hit_obj)` | When collision ends |

---

## 🧱 s_TmpObject

Temporary object not attached to any `Game_Event`, not saved to files.

```js
new s_TmpObject(img, hitbox = [1, 1], location = [0, 0], type = 'object', custom_id = null);
```

| Parameter | Description |
|:--|:--|
| `img` | Image name (String) |
| `hitbox` | `[width, height]` |
| `location` | `[x, y]` starting position |
| `type` | `'object'`, `'block'`, or `'collision'` |
| `custom_id` | Optional custom ID |

---

## 🧩 s_Block

Creates a fixed, non-rotating s_Object based on `regionId`.

```js
new s_Block(regionId, start, end = start);
```

| Parameter | Description |
|:--|:--|
| `regionId` | The region ID number |
| `start`, `end` | `[x, y]` coordinates of two corners |

🖼️ **Example:**  
<img width="1803" height="862" alt="Screenshot 2025-10-23 011644" src="https://github.com/user-attachments/assets/82450863-9f0a-4a1f-98f0-0ff1ae4a7aee" />
If you mark two opposite corners on the map with the same region ID, a rectangular block covering that area will be automatically created.

---

## ⚙️ s_Physics

Handles physical forces and motion of `s_Object`.

| Property / Method | Description |
|:--|:--|
| `I` | Returns the moment of inertia for the rectangular object |
| `force(force, point = s_obj.loc)` | Applies a force `[x, y]` at a world-space point |
| `force_rel(force, point = [0,0])` | Applies a relative force (`[0,0]` = center) |

---

## 🪢 s_Joint

Connects two s_Object instances, simulating a spring joint.

```js
new s_Joint(s_obj_a, s_obj_b, arm_length, nf, zetta, point_a = [0, 0], point_b = [0, 0], name);
```

| Parameter | Description |
|:--|:--|
| `s_obj_a`, `s_obj_b` | Two s_Object instances to connect |
| `arm_length` | Resting length of the joint |
| `nf`, `zetta` | Frequency and damping ratio |
| `point_a`, `point_b` | Connection points relative to each object |
| `name` | Joint name |

| Method | Description |
|:--|:--|
| `destroy()` | Removes the joint |

---## ⚔️ s_COLLIDER  

A collection of functions related to **collision detection and calculations** between objects.

### 🔹 Method

```js
s_COLLIDER.line_trace(start, end, ignore_objs, debug_line = false)
```

| Parameter | Description |
|:--|:--|
| `start` | Starting point `[x, y]` |
| `end` | Ending point `[x, y]` |
| `ignore_objs` | List of objects to ignore during collision check |
| `debug_line` | Whether to draw the debug line (boolean) |

**Return Value:**
```js
{
  hit: boolean,              // Whether a collision occurred
  point_hit: [x, y],         // Collision point coordinates
  length_hit: Number,        // Distance to collision
  normal_hit: [x, y]         // Normal vector of the collision surface
}
```

---

## 🎥 s_Camera  

Controls the **main game camera**.

| Property / Method | Description |
|:--|:--|
| `s_cam.target` | (`s_Object`) If set, the camera follows the center of the target. |
| `s_cam.shake(time, power = [1, 1], range = [0.1, 0.1])` | Adds a shake effect to the camera. (Can be stacked) |

---

## 🎮 s_Controller  

Handles **user input**.  
Primarily used with `s_Pawn` to control objects.  
If `is_player` is `true`, keyboard and mouse input are automatically collected.

### 🔹 Constructor

```js
new s_Controller(is_player = false);
```

### 🔹 Methods

| Method | Description |
|:--|:--|
| `update_input(key, type)` | Saves a new input state. `key` is a string, and `type` is a number. |

**Input Type Codes (Keyboard):**

| Type | Meaning |
|:--|:--|
| `0` | No input |
| `1` | Holding input |
| `2` | Just released |
| `3` | Just pressed |

---

## 🧍 s_Pawn  

An `s_Object` that can be **possessed or controlled** by an `s_Controller`.

| Property / Method | Description |
|:--|:--|
| `Ievents` | Returns the list of input event mappings. |
| `add_Ievent(key, event)` | Adds a custom input event (`event = function(type) {}`); overwrites if key exists. |
| `delete_Ievent(key)` | Deletes a registered input event. |

---

## 🧍‍♂️ s_Character  

Extends `s_Pawn` to provide **character movement, acceleration, and jumping** features.

| Property | Description |
|:--|:--|
| `accel` | Acceleration rate while moving |
| `decel` | Deceleration rate while idle |
| `max_speed` | Maximum movement speed |
| `jump_speed` | Velocity applied on jump |
| `max_jump_cnt` | Maximum number of jumps allowed |

| Method | Description |
|:--|:--|
| `add_movement(dir, power = 1)` | Moves the character in the specified direction. |
| `jump(ignore_v = false)` | Makes the character jump. |

---

## 🎞️ s_AnimHelper  

A helper class for **managing the animation** of an `s_Object`.

### 🔹 Constructor

```js
new s_AnimHelper(s_object, img_src, status);
```

| Property / Method | Description |
|:--|:--|
| `img` | Character sprite name (inside `/characters` folder) |
| `status` | Character sprite status index (usually 0 ~ 8) |
| `update(status)` | Updates the character image according to the given status. |

---

## DEMO Project
https://drive.google.com/file/d/1PNsSlV0MuREa6zoeZSWWS1Kx5RnAJVxD/view?usp=sharing                        
현재 개발중

## Videos
https://gall.dcinside.com/mgallery/board/view?id=kadokawarpgmaker&no=7614                     
https://gall.dcinside.com/mgallery/board/view?id=kadokawarpgmaker&no=7606                
https://gall.dcinside.com/mgallery/board/view?id=kadokawarpgmaker&no=7570                   
https://youtu.be/K9QtO2sVelw                      
 
