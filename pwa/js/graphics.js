// Graphics lab: the same spinning triangle in WebGPU and WebGL 2
(function () {
  const log = Lab.logger(document.getElementById('log'));
  const $ = id => document.getElementById(id);
  const kv = rows => rows
    .map(([k, v]) => '<div><dt>' + Lab.escape(k) + '</dt><dd>' + Lab.escape(v) + '</dd></div>')
    .join('');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Shared frame-rate counter per renderer
  function fpsCounter(onUpdate) {
    let frames = 0;
    let last = performance.now();
    return () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        onUpdate(Math.round(frames * 1000 / (now - last)));
        frames = 0;
        last = now;
      }
    };
  }

  const WGSL = `
struct Uniforms { angle: f32 };
@group(0) @binding(0) var<uniform> u: Uniforms;

struct Out {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex fn vs(@builtin(vertex_index) i: u32) -> Out {
  var points = array<vec2f, 3>(vec2f(0.0, 0.7), vec2f(-0.65, -0.45), vec2f(0.65, -0.45));
  var colors = array<vec3f, 3>(vec3f(0.29, 0.87, 0.5), vec3f(0.38, 0.65, 0.98), vec3f(0.98, 0.75, 0.14));
  let c = cos(u.angle);
  let s = sin(u.angle);
  let p = points[i];
  var out: Out;
  out.position = vec4f(p.x * c - p.y * s, p.x * s + p.y * c, 0.0, 1.0);
  out.color = colors[i];
  return out;
}

@fragment fn fs(input: Out) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}`;

  async function webgpu() {
    if (!('gpu' in navigator)) {
      Lab.setStatus($('gpuStatus'), 'no');
      $('gpuInfo').innerHTML = kv([['WebGPU', 'Not available']]);
      return;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No GPU adapter');
      const device = await adapter.requestDevice();
      const info = adapter.info || {};
      const rows = [
        ['Vendor', info.vendor || '–'],
        ['Architecture', info.architecture || '–'],
        ['Features', String(adapter.features.size)],
        ['Max texture', adapter.limits.maxTextureDimension2D + ' px']
      ];

      const canvas = $('gpuCanvas');
      const context = canvas.getContext('webgpu');
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });

      const module = device.createShaderModule({ code: WGSL });
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' }
      });
      const uniforms = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniforms } }]
      });

      const tick = fpsCounter(fps => {
        $('gpuInfo').innerHTML = kv([...rows, ['Frame rate', fps + ' fps']]);
      });
      $('gpuInfo').innerHTML = kv(rows);

      const frame = time => {
        device.queue.writeBuffer(uniforms, 0, new Float32Array([reduceMotion ? 0 : time / 1000]));
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.05, g: 0.06, b: 0.07, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
        tick();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      Lab.setStatus($('gpuStatus'), 'yes', 'Rendering');
      log('WebGPU device ready (' + format + ')', 'ok');
      device.lost.then(lost => log('WebGPU device lost: ' + lost.message, 'error'));
    } catch (error) {
      Lab.setStatus($('gpuStatus'), 'no', 'Failed');
      log('WebGPU failed: ' + error.message, 'error');
    }
  }

  function webgl() {
    const canvas = $('glCanvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      Lab.setStatus($('glStatus'), 'no');
      return;
    }
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
      uniform float angle;
      out vec3 color;
      void main() {
        vec2 points[3] = vec2[3](vec2(0.0, 0.7), vec2(-0.65, -0.45), vec2(0.65, -0.45));
        vec3 colors[3] = vec3[3](vec3(0.29, 0.87, 0.5), vec3(0.38, 0.65, 0.98), vec3(0.98, 0.75, 0.14));
        vec2 p = points[gl_VertexID];
        float c = cos(angle), s = sin(angle);
        gl_Position = vec4(p.x * c - p.y * s, p.x * s + p.y * c, 0.0, 1.0);
        color = colors[gl_VertexID];
      }`));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float;
      in vec3 color;
      out vec4 fragColor;
      void main() { fragColor = vec4(color, 1.0); }`));
    gl.linkProgram(program);
    gl.useProgram(program);
    const angle = gl.getUniformLocation(program, 'angle');

    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const rows = [
      ['Renderer', debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)],
      ['Version', gl.getParameter(gl.VERSION)],
      ['Max texture', gl.getParameter(gl.MAX_TEXTURE_SIZE) + ' px']
    ];
    $('glInfo').innerHTML = kv(rows);
    const tick = fpsCounter(fps => {
      $('glInfo').innerHTML = kv([...rows, ['Frame rate', fps + ' fps']]);
    });

    const frame = time => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.05, 0.06, 0.07, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(angle, reduceMotion ? 0 : -time / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      tick();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    Lab.setStatus($('glStatus'), 'yes', 'Rendering');
  }

  webgpu();
  try {
    webgl();
  } catch (error) {
    Lab.setStatus($('glStatus'), 'no', 'Failed');
    log('WebGL failed: ' + error.message, 'error');
  }
})();
