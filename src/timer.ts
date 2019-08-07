/*! Copyright 2019 Joren Van Onder <joren@jvo.sh>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

class Coordinate {
  private _x: number;
  private _y: number;

  constructor(x: number, y: number) {
    this._x = x;
    this._y = y;
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  set x(new_x: number) {
    this._x = new_x;
  }

  set y(new_y: number) {
    this._y = new_y;
  }

  scale(n: number): void {
    this._x *= n;
    this._y *= n;
  }

  translate(n: number): void;
  translate(x: number, y: number): void;
  translate(n_x: number, y?: number): void {
    this._x += n_x;

    if (y === undefined) {
      this._y += n_x;
    } else {
      this._y += y;
    }
  }

  /**
   * Scales from a range of [-1, 1] to [0, max].
   */
  expand_to(max: number): void {
    this.translate(1);
    this.scale(0.5 * max);
  }
}

class TimerCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private center: Coordinate;
  private needs_full_render: boolean;
  private animation_timer: number | undefined;
  private prev_render_ms: number;
  private remaining_seconds: number;

  // measured counterclockwise from 0
  private time_radians: number;

  // drag variables
  private drag_starting_angle: number | undefined;
  private drag_starting_remaining_seconds: number | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("could not get 2d context for canvas");
    }

    this.ctx = context;
    this.center = new Coordinate(0, 0);
    this.prev_render_ms = Date.now();
    this.remaining_seconds = 2 * 60;
    this.needs_full_render = true;
    this.time_radians = this.seconds_to_radians(this.remaining_seconds);
    this.setup();
  }

  private set_remaining_seconds(s: number) {
    // add hours until it's positive to deal with zero crossings
    while (s < 0) {
      s += 60 * 60;
    }

    this.remaining_seconds = s;
    this.time_radians = this.seconds_to_radians(this.remaining_seconds);
  }

  private seconds_to_radians(secs: number): number {
    return ((secs / 60) * Math.PI) / 30;
  }

  private radians_to_seconds(rads: number): number {
    // 2π radians is 60 mins
    // 1 radian is 60 mins / 2π
    return rads * (60 / (2 * Math.PI)) * 60;
  }

  private setup_resolution() {
    console.log(
      "client size",
      this.canvas.clientWidth,
      this.canvas.clientHeight
    );
    console.log("before", this.canvas.width, this.canvas.height);

    if (
      this.canvas.width !== this.canvas.clientWidth ||
      this.canvas.height !== this.canvas.clientHeight
    ) {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientWidth;
      this.center.x = this.canvas.width / 2;
      this.center.y = this.canvas.height / 2;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.needs_full_render = true;
    }

    console.log("after", this.canvas.width, this.canvas.height);
  }

  private setup_font() {
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = `${this.canvas.width * 0.05}px monospace`;
  }

  private render_clock() {
    const nr_elements = 12 /* hours */ * 5 /* marks */;
    const degrees_per_element = (2 * Math.PI) / nr_elements;
    const text_margin = 0.1;
    const mark_end_margin = 0.2;
    const mark_begin_margin = 0.3;
    const diameter = this.canvas.height;
    let degrees = -Math.PI / 2;

    this.ctx.fillStyle = "black";
    for (let i = 0; i < nr_elements; i++) {
      const pos = new Coordinate(Math.cos(degrees), Math.sin(degrees));

      if (this.needs_full_render && i % 5 == 0) {
        const text_pos: Coordinate = Object.create(pos);
        text_pos.expand_to(diameter * (1 - text_margin));
        text_pos.translate((diameter * text_margin) / 2);

        this.ctx.fillText(`${(i * 5) / 5}`, text_pos.x, text_pos.y);
      }

      // marks
      const mark_begin: Coordinate = Object.create(pos);
      const mark_end: Coordinate = Object.create(pos);

      mark_begin.expand_to(diameter * (1 - mark_end_margin));
      mark_begin.translate((diameter * mark_end_margin) / 2);

      mark_end.expand_to(diameter * (1 - mark_begin_margin));
      mark_end.translate((diameter * mark_begin_margin) / 2);

      this.ctx.beginPath();
      if (i % 5 == 0) {
        this.ctx.lineWidth = 5;
      } else {
        this.ctx.lineWidth = 1;
      }

      this.ctx.moveTo(mark_begin.x, mark_begin.y);
      this.ctx.lineTo(mark_end.x, mark_end.y);
      this.ctx.stroke();
      this.ctx.closePath();

      degrees -= degrees_per_element;
    }

    this.ctx.closePath();
    this.needs_full_render = false;
  }

  private render_fill() {
    const margin = 0.2;
    const radius = this.center.y * (1.0 - margin);
    const top_radians = (3 / 2) * Math.PI;

    // draw arc from 0 to x
    this.ctx.beginPath();
    this.ctx.moveTo(this.center.x, this.center.y);
    this.ctx.arc(
      this.center.x,
      this.center.y,
      radius,
      top_radians - this.time_radians,
      top_radians
    );
    this.ctx.fillStyle = "red";
    this.ctx.fill();
    this.ctx.closePath();

    // draw little black dial
    this.ctx.beginPath();
    this.ctx.moveTo(this.center.x, this.center.y);
    this.ctx.arc(
      this.center.x,
      this.center.y,
      this.canvas.height / 20,
      0,
      2 * Math.PI
    );
    this.ctx.fillStyle = "black";
    this.ctx.fill();
    this.ctx.closePath();
  }

  private render() {
    if (this.canvas.width != this.canvas.height) {
      this.setup_resolution();
    }

    this.ctx.beginPath();
    this.ctx.arc(
      this.center.x,
      this.center.y,
      this.center.y * 0.81,
      0,
      2 * Math.PI
    );
    this.ctx.fillStyle = "white";
    this.ctx.fill();
    this.ctx.closePath();

    this.setup_font();
    this.render_fill();
    this.render_clock();
    this.prev_render_ms = Date.now();
  }

  private animate_clock() {
    clearTimeout(this.animation_timer);
    this.animation_timer = window.setInterval(() => {
      const secs_since_last_render = (Date.now() - this.prev_render_ms) / 1000;
      this.render();
      if (this.remaining_seconds - secs_since_last_render < 0) {
        clearTimeout(this.animation_timer);
        this.set_remaining_seconds(0);
        this.render();
      } else {
        this.set_remaining_seconds(
          this.remaining_seconds - secs_since_last_render
        );
      }
    }, 200);
  }

  private mousemove_handler(event: MouseEvent | Touch) {
    const rect = (<Element>event.target).getBoundingClientRect();
    const pos: Coordinate = new Coordinate(
      event.pageX - rect.left,
      event.pageY - rect.top
    );

    // center pos
    pos.translate(-this.center.x, -this.center.y);

    let angle = Math.atan2(pos.y, pos.x);
    if (angle < 0) {
      angle += 2 * Math.PI;
    }

    angle += (1 / 2) * Math.PI;
    angle %= 2 * Math.PI;

    if (
      this.drag_starting_angle === undefined ||
      this.drag_starting_remaining_seconds === undefined
    ) {
      this.drag_starting_angle = angle;
      this.drag_starting_remaining_seconds = this.remaining_seconds;
    } else {
      const diff = this.drag_starting_angle - angle;
      const seconds_diff = this.radians_to_seconds(diff);
      this.set_remaining_seconds(
        this.drag_starting_remaining_seconds + seconds_diff
      );
    }

    this.render();
    this.animate_clock();
  }

  private handlers() {
    const mousemove_handler = this.mousemove_handler.bind(this);
    const touchmove_handler = (e: TouchEvent) => {
      mousemove_handler(e.touches[0]);
    };

    this.canvas.addEventListener("mouseup", () => {
      this.canvas.removeEventListener("mousemove", mousemove_handler);
      this.drag_starting_angle = undefined;
      this.drag_starting_remaining_seconds = undefined;
    });

    this.canvas.addEventListener("touchend", () => {
      this.canvas.removeEventListener("touchmove", touchmove_handler);
      this.drag_starting_angle = undefined;
      this.drag_starting_remaining_seconds = undefined;
    });

    this.canvas.addEventListener("mousedown", () => {
      this.canvas.addEventListener("mousemove", mousemove_handler);
    });

    this.canvas.addEventListener("touchstart", () => {
      this.canvas.addEventListener("touchmove", touchmove_handler);
    });

    window.addEventListener("resize", this.setup_resolution.bind(this));
  }

  private setup() {
    console.log("entered setup");
    this.render();
    this.handlers();
    this.animate_clock();
  }
}

new TimerCanvas(<HTMLCanvasElement>document.getElementById("timer-canvas")!!);
