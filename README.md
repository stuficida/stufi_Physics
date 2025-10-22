# 🧩 stufi_Physics.js
**제작자:** 텁텁한사이다  
**용도:** RPG Maker MZ에서 물리를 구현하는 오픈소스 프로젝트

---

## 📦 필수 외부 플러그인
> 반드시 **`GALV_CharacterFramesMZ.js`** 가  
> **stuficida*.js** 보다 상단에 위치해야 합니다.

---

## 📘 사용 기본 구조
모든 코드는 아래와 같은 이벤트 구조를 따라야 합니다:

```
<img width="1052" height="709" alt="Screenshot 2025-10-23 004158" src="https://github.com/user-attachments/assets/258a2c6e-6abe-4cf5-967c-435a368816fc" />
<스크립트 내용>
// 반드시 마지막에
Control Self Switch: A = ON
```

- Self Switch는 **항상 A**여야 합니다.  
- 처음 상태는 **OFF**여야 하며,  
- 이후 스크립트 실행 후 **ON으로 변경**됩니다.

---

## 🧱 클래스 개요

| 클래스 | 설명 |
|:--|:--|
| `s_Object` | 이벤트에 기생하여 물리적 속성(위치, 회전, 충돌 등)을 제공 |
| `s_TmpObject` | 세이브되지 않는 임시 물체 (이벤트 비의존형) |
| `s_Block` | `regionId` 기반의 고정된 물체 (이동 및 회전 불가) |
| `s_Physics` | 물리 계산(힘, 회전, 관성 등)을 담당하는 내부 클래스 |
| `s_Joint` | 두 물체를 스프링처럼 연결하는 조인트 시스템 |

---

## 🧩 s_Object

이벤트(`Game_Event`)나 캐릭터에 덧씌워서 사용하는 물리 오브젝트입니다.

```js
new s_Object(event, hitbox = [1, 1], type = 'object');
```

| 매개변수 | 설명 |
|:--|:--|
| `event` | `Game_Event` 또는 이벤트 ID(Number) |
| `hitbox` | `[width, height]` 형식의 히트박스 |
| `type` | `'object'`, `'block'`, `'collision'` 중 하나 |

---

### 🔹 정적 속성 (Static)

| 속성 | 설명 |
|:--|:--|
| `s_Object.list` | 현재 맵의 모든 s_Object 목록 |
| `s_Object.find(id)` | ID로 s_Object 검색 |
| `s_Object.find_by_tag(tag)` | 태그(String)로 검색 |
| `s_Object.player` | `$gamePlayer`의 s_Object 반환 |
| `s_Object.has_player` | 플레이어 s_Object 존재 여부 |
| `s_Object.save()` | 맵의 모든 s_Object 저장 (세이브 시 자동 실행) |

---

### 🔹 게터 (Getter)

| 이름 | 반환값 |
|:--|:--|
| `obj` | 기생 중인 `Game_Event` 또는 `Game_Character` |
| `id` | 오브젝트의 고유 ID |
| `vertices` | 꼭짓점 좌표 (RT → LT → LB → RB) |
| `normals` | 각 면의 법선 벡터 |
| `is_falling` | 지면 접촉 여부 |

---

### 🔹 세터 (Setter)

| 메서드 | 설명 |
|:--|:--|
| `w`, `h`, `hitbox([w,h])` | 히트박스 크기 설정 |
| `x`, `y`, `loc([x,y])` | 위치 설정 |
| `z` | 표시 순서(클수록 앞으로) |
| `angle`, `angle_rad` | 회전각 설정 (도/라디안) |

---

### 🔹 메서드 (Methods)

| 메서드 | 설명 |
|:--|:--|
| `destroy()` | 오브젝트를 맵에서 제거 |

---

### 🔹 이벤트 훅 (Hooks)

| 메서드 | 호출 시점 |
|:--|:--|
| `start()` | 오브젝트 생성 시 |
| `end()` | `destroy()` 시 |
| `tick()` | 매 프레임마다 |
| `collied_in(hit_obj, collision)` | 충돌 시작 시 |
| `collied_out(hit_obj)` | 충돌 종료 시 |

---

## 🧱 s_TmpObject

저장되지 않으며, 이벤트에 연결되지 않는 임시 오브젝트입니다.

```js
new s_TmpObject(img, hitbox = [1, 1], location = [0, 0], type = 'object', custom_id = null);
```

| 매개변수 | 설명 |
|:--|:--|
| `img` | 이미지 이름(String) |
| `hitbox` | `[width, height]` |
| `location` | `[x, y]` 초기 위치 |
| `type` | `'object'`, `'block'`, `'collision'` |
| `custom_id` | 임의의 ID (선택) |

---

## 🧩 s_Block

`regionId`로 지정된 영역을 기반으로 고정된 s_Object를 생성합니다.

```js
new s_Block(regionId, start, end = start);
```

| 매개변수 | 설명 |
|:--|:--|
| `regionId` | 사용할 Region ID |
| `start`, `end` | `[x, y]` 형식의 두 꼭짓점 |

🖼️ **예시:**  
<img width="1803" height="862" alt="Screenshot 2025-10-23 011644" src="https://github.com/user-attachments/assets/82450863-9f0a-4a1f-98f0-0ff1ae4a7aee" />
지도에 대각선 방향으로 두 점을 찍으면, 자동으로 해당 범위를 포함하는 직사각형 블록이 생성됩니다.  
(즉, `(x1, y1)`과 `(x2, y2)`를 지정하면 그 사이의 사각형을 자동 계산)

---

## ⚙️ s_Physics

`s_Object`의 내부 물리 연산을 담당합니다.

| 항목 | 설명 |
|:--|:--|
| `I` | 물체의 관성모멘트 |
| `force(force, point = s_obj.loc)` | 절대 좌표 기준으로 힘 작용 |
| `force_rel(force, point = [0,0])` | 상대 좌표 기준으로 힘 작용 (`[0,0]` = 중심) |

---

## 🪢 s_Joint

두 s_Object를 연결하여 **스프링/탄성** 효과를 제공합니다.

```js
new s_Joint(s_obj_a, s_obj_b, arm_length, nf, zetta, point_a = [0, 0], point_b = [0, 0], name);
```

| 매개변수 | 설명 |
|:--|:--|
| `s_obj_a`, `s_obj_b` | 연결할 두 s_Object |
| `arm_length` | 기준 거리 (스프링 길이) |
| `nf`, `zetta` | 진동수, 감쇠비 |
| `point_a`, `point_b` | 각 오브젝트의 연결 지점 |
| `name` | 조인트 이름 |

| 메서드 | 설명 |
|:--|:--|
| `destroy()` | 조인트 제거 |

---

## DEMO Project
현재 개발중

## 관련 영상 및 링크
https://gall.dcinside.com/mgallery/board/view?id=kadokawarpgmaker&no=7614
https://gall.dcinside.com/mgallery/board/view?id=kadokawarpgmaker&no=7606
https://gall.dcinside.com/mgallery/board/view?id=kadokawarpgmaker&no=7570
https://youtu.be/K9QtO2sVelw
