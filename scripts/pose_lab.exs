#!/usr/bin/env elixir

defmodule MentellPoseLab do
  @root Path.expand("..", __DIR__)
  @poses_path Path.join(@root, "src/features/character/characterPoses.ts")
  @manifest_path Path.join(@root, "src/features/character/charManifest.generated.ts")
  @svg_path Path.join(@root, "asset/char/charprod.svg")
  @default_out Path.join(@root, "tmp/character-pose-lab.html")

  def main(argv) do
    case argv do
      [] -> help()
      ["help"] -> help()
      ["list"] -> list_poses()
      ["get", pose] -> get_pose(pose)
      ["set", pose, arm_l, arm_r] -> set_pose(pose, arm_l, arm_r)
      ["preview" | rest] -> preview(rest)
      ["app" | rest] -> app(rest)
      _ -> abort("Unknown command.\n\n#{usage()}")
    end
  end

  defp help do
    IO.puts(usage())
  end

  defp usage do
    """
    Mentell character pose lab

    Commands:
      elixir scripts/pose_lab.exs list
      elixir scripts/pose_lab.exs get wave
      elixir scripts/pose_lab.exs set wave 104 -28
      elixir scripts/pose_lab.exs preview [--pose wave] [--out tmp/character-pose-lab.html]
      elixir scripts/pose_lab.exs app [--pose wave] [--port 4057]

    preview writes a standalone HTML tool.
    app starts a tiny local desktop-style web app that reloads current assets on refresh
    and can save pose numbers back to characterPoses.ts.
    """
  end

  defp list_poses do
    poses()
    |> Enum.each(fn {name, left, right} ->
      IO.puts(
        String.pad_trailing(name, 10) <>
          " armL: #{format_number(left)}\tarmR: #{format_number(right)}"
      )
    end)
  end

  defp get_pose(pose) do
    case Enum.find(poses(), fn {name, _, _} -> name == pose end) do
      nil -> abort("Pose not found: #{pose}")
      {name, left, right} ->
        IO.puts("#{name}: { armL: #{format_number(left)}, armR: #{format_number(right)} }")
    end
  end

  defp set_pose(pose, arm_l, arm_r) do
    left = parse_number!(arm_l, "armL")
    right = parse_number!(arm_r, "armR")
    write_pose!(pose, left, right)
    IO.puts("Updated #{Path.relative_to_cwd(@poses_path)}")
    IO.puts("#{pose}: { armL: #{format_number(left)}, armR: #{format_number(right)} }")
  end

  defp write_pose!(pose, left, right) do
    source = File.read!(@poses_path)

    pattern =
      ~r/(#{Regex.escape(pose)}:\s*\{\s*armL:\s*)-?\d+(?:\.\d+)?(,\s*armR:\s*)-?\d+(?:\.\d+)?(\s*\})/

    unless Regex.match?(pattern, source) do
      raise ArgumentError, "Pose not found in #{@poses_path}: #{pose}"
    end

    next =
      Regex.replace(pattern, source, fn _, before_left, middle, after_right ->
        before_left <> format_number(left) <> middle <> format_number(right) <> after_right
      end)

    File.write!(@poses_path, next)
  end

  defp preview(args) do
    {opts, rest, invalid} =
      OptionParser.parse(args,
        strict: [out: :string, pose: :string],
        aliases: [o: :out, p: :pose]
      )

    if rest != [] or invalid != [] do
      abort("Invalid preview options.\n\n#{usage()}")
    end

    out = opts[:out] || @default_out
    pose = opts[:pose] || "wave"
    File.mkdir_p!(Path.dirname(out))
    File.write!(out, html(pose, false))
    IO.puts("Wrote #{Path.relative_to_cwd(out)}")
    IO.puts("Open it in your browser to preview poses and cosmetics.")
  end

  defp app(args) do
    {opts, rest, invalid} =
      OptionParser.parse(args,
        strict: [port: :integer, pose: :string],
        aliases: [p: :pose]
      )

    if rest != [] or invalid != [] do
      abort("Invalid app options.\n\n#{usage()}")
    end

    port = opts[:port] || 4057
    pose = opts[:pose] || "wave"
    {:ok, socket} = :gen_tcp.listen(port, [:binary, active: false, packet: :raw, reuseaddr: true])
    url = "http://127.0.0.1:#{port}/"

    IO.puts("Mentell Pose Lab app running at #{url}")
    IO.puts("Refresh the page after editing SVG assets or regenerating the manifest.")
    IO.puts("Press Ctrl+C to stop.")

    accept_loop(socket, pose)
  end

  defp accept_loop(socket, pose) do
    {:ok, client} = :gen_tcp.accept(socket)
    spawn(fn -> handle_client(client, pose) end)
    accept_loop(socket, pose)
  end

  defp handle_client(client, pose) do
    request = read_request(client, "")
    response = route(request, pose)
    :ok = :gen_tcp.send(client, response)
    :gen_tcp.close(client)
  rescue
    error ->
      body = "Pose lab error: #{Exception.message(error)}"
      :gen_tcp.send(client, response(500, "text/plain; charset=utf-8", body))
      :gen_tcp.close(client)
  end

  defp read_request(client, acc) do
    {:ok, chunk} = :gen_tcp.recv(client, 0, 1000)
    next = acc <> chunk

    if String.contains?(next, "\r\n\r\n") do
      [head, body] = String.split(next, "\r\n\r\n", parts: 2)
      content_length = content_length(head)

      if byte_size(body) >= content_length do
        next
      else
        read_request(client, next)
      end
    else
      read_request(client, next)
    end
  end

  defp content_length(head) do
    head
    |> String.split("\r\n")
    |> Enum.find_value(0, fn line ->
      case String.split(line, ":", parts: 2) do
        [name, value] ->
          if String.downcase(name) == "content-length" do
            value |> String.trim() |> String.to_integer()
          end

        _ ->
          nil
      end
    end)
  end

  defp route(request, pose) do
    [head, body] = String.split(request, "\r\n\r\n", parts: 2)
    [request_line | _headers] = String.split(head, "\r\n")
    [method, path | _] = String.split(request_line, " ")

    case {method, path} do
      {"GET", "/"} ->
        response(200, "text/html; charset=utf-8", html(pose, true))

      {"HEAD", "/"} ->
        response(200, "text/html; charset=utf-8", "")

      {"GET", "/health"} ->
        response(200, "text/plain; charset=utf-8", "ok")

      {"HEAD", "/health"} ->
        response(200, "text/plain; charset=utf-8", "")

      {"POST", "/api/pose"} ->
        save_pose_from_body(body)

      _ ->
        response(404, "text/plain; charset=utf-8", "not found")
    end
  end

  defp save_pose_from_body(body) do
    params = URI.decode_query(body)
    pose = Map.fetch!(params, "pose")
    left = parse_number!(Map.fetch!(params, "armL"), "armL")
    right = parse_number!(Map.fetch!(params, "armR"), "armR")
    write_pose!(pose, left, right)

    response(
      200,
      "application/json; charset=utf-8",
      ~s({"ok":true,"message":"Saved #{pose}: { armL: #{format_number(left)}, armR: #{format_number(right)} }"})
    )
  rescue
    error ->
      response(400, "application/json; charset=utf-8", ~s({"ok":false,"message":#{inspect(Exception.message(error))}}))
  end

  defp response(status, content_type, body) do
    reason =
      case status do
        200 -> "OK"
        400 -> "Bad Request"
        404 -> "Not Found"
        500 -> "Internal Server Error"
      end

    [
      "HTTP/1.1 #{status} #{reason}\r\n",
      "content-type: #{content_type}\r\n",
      "cache-control: no-store\r\n",
      "content-length: #{byte_size(body)}\r\n",
      "connection: close\r\n",
      "\r\n",
      body
    ]
  end

  defp poses do
    source = File.read!(@poses_path)
    regex = ~r/(\w+):\s*\{\s*armL:\s*(-?\d+(?:\.\d+)?),\s*armR:\s*(-?\d+(?:\.\d+)?)\s*\}/

    Regex.scan(regex, source)
    |> Enum.map(fn [_, name, left, right] ->
      {name, parse_number!(left, "armL"), parse_number!(right, "armR")}
    end)
  end

  defp manifest_json do
    source = File.read!(@manifest_path)

    case Regex.run(~r/export const charManifest = (\{.*?\}) as const/s, source) do
      [_, json] -> json
      _ -> abort("Could not parse char manifest from #{@manifest_path}")
    end
  end

  defp html(initial_pose, server_mode) do
    svg = File.read!(@svg_path)
    poses_json = poses_to_json(poses())

    """
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Mentell Pose Lab</title>
      <style>
        :root {
          color-scheme: light;
          --paper: #fbf4de;
          --ink: #19181f;
          --muted: rgba(25, 24, 31, 0.68);
          --border: rgba(25, 24, 31, 0.14);
          --desk: #727477;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100svh;
          background: var(--desk);
          color: var(--ink);
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        main {
          display: grid;
          grid-template-columns: minmax(18rem, 28rem) minmax(22rem, 1fr);
          gap: 1rem;
          padding: 1rem;
          min-height: 100svh;
        }
        section {
          background: var(--paper);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 1rem;
        }
        .stage {
          display: grid;
          place-items: center;
          min-height: calc(100svh - 2rem);
          overflow: visible;
        }
        .character {
          width: min(72vw, 32rem);
          height: min(84vh, 42rem);
        }
        .character svg {
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
        }
        h1, h2 {
          margin: 0;
          font-size: 1.15rem;
        }
        h2 { margin-top: 1.25rem; }
        label {
          display: grid;
          gap: 0.35rem;
          margin-top: 0.75rem;
          font-size: 0.9rem;
          font-weight: 650;
        }
        input, select, button, textarea {
          font: inherit;
        }
        input[type="range"] { width: 100%; }
        input[type="color"] {
          width: 100%;
          height: 2.25rem;
        }
        select, button, textarea {
          border: 1px solid var(--border);
          border-radius: 10px;
          background: transparent;
          color: var(--ink);
          padding: 0.55rem 0.7rem;
        }
        button {
          cursor: pointer;
          font-weight: 700;
        }
        textarea {
          width: 100%;
          min-height: 6rem;
          resize: vertical;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.82rem;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.75rem;
          align-items: center;
        }
        .value {
          min-width: 4rem;
          text-align: right;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .hint {
          margin: 0.35rem 0 0;
          color: var(--muted);
          font-size: 0.85rem;
        }
        @media (max-width: 820px) {
          main { grid-template-columns: 1fr; }
          .stage { min-height: 60svh; }
          .character { width: min(88vw, 24rem); height: 32rem; }
        }
      </style>
    </head>
    <body>
      <main>
        <section>
          <h1>Mentell Pose Lab</h1>
          <p class="hint">Tune arm rotations and cosmetics against the current production SVG.</p>
          <p class="hint">Edit assets in asset/char, run sync if labels changed, then refresh this app.</p>

          <label>
            Pose
            <select id="pose"></select>
          </label>

          <label>
            <div class="row"><span>Left arm</span><span id="armLValue" class="value"></span></div>
            <input id="armL" type="range" min="-140" max="140" step="1" />
          </label>

          <label>
            <div class="row"><span>Right arm</span><span id="armRValue" class="value"></span></div>
            <input id="armR" type="range" min="-140" max="140" step="1" />
          </label>

          <h2>Cosmetics</h2>
          <div id="fills" class="grid"></div>
          <div id="toggles" class="grid"></div>

          <h2>Output</h2>
          <textarea id="snippet" spellcheck="false"></textarea>
          <div class="grid">
            <button id="copy" type="button">Copy snippet</button>
            <button id="saveSource" type="button">Save pose to source</button>
            <button id="save" type="button">Download poses JSON</button>
          </div>
          <p id="status" class="hint"></p>
        </section>

        <section class="stage">
          <div id="character" class="character">#{svg}</div>
        </section>
      </main>

      <script>
        const charManifest = #{manifest_json()};
        const poses = #{poses_json};
        const initialPose = #{inspect(initial_pose)};
        const serverMode = #{if(server_mode, do: "true", else: "false")};
        const defaultAppearance = JSON.parse(JSON.stringify(charManifest.appearanceDefaults));
        const state = {
          pose: poses[initialPose] ? initialPose : Object.keys(poses)[0],
          appearance: defaultAppearance,
        };

        const svg = document.querySelector('#character svg');
        const baseTransformAttr = 'data-pose-lab-base-transform';

        function getBaseTransform(el) {
          if (!el) return '';
          const stored = el.getAttribute(baseTransformAttr);
          if (stored !== null) return stored;
          const initial = el.getAttribute('transform') || '';
          el.setAttribute(baseTransformAttr, initial);
          return initial;
        }

        function shoulderPivot(joint) {
          const path = joint?.querySelector('path');
          if (path && path.getPointAtLength) {
            try {
              const point = path.getPointAtLength(0);
              if (Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
            } catch {}
          }
          const box = joint.getBBox();
          return { x: box.x + box.width / 2, y: box.y };
        }

        function rotateWithBase(el, deg, pivot) {
          const base = getBaseTransform(el);
          const rotate = `rotate(${deg} ${pivot.x} ${pivot.y})`;
          el.setAttribute('transform', base ? `${base} ${rotate}` : rotate);
        }

        function darken(hex, amount = 0.42) {
          const raw = hex.replace('#', '');
          if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return hex;
          const full = raw.length === 3 ? raw.split('').map((x) => x + x).join('') : raw;
          const parts = [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16));
          return '#' + parts.map((part) => Math.max(0, Math.round(part * (1 - amount))).toString(16).padStart(2, '0')).join('');
        }

        function hasStroke(el) {
          const stroke = el.style.stroke || el.getAttribute('stroke') || '';
          return stroke && stroke !== 'none';
        }

        function setVisible(id, show) {
          const el = svg.getElementById(id);
          if (!el) return;
          el.style.display = show ? 'inline' : 'none';
          if (id === 'g102') el.style.opacity = show ? '1' : '0';
        }

        function ensureEyeGradient(id, color) {
          let gradient = svg.getElementById(id);
          if (gradient) return gradient;
          let defs = svg.querySelector('defs');
          if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svg.insertBefore(defs, svg.firstChild);
          }
          gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
          gradient.id = id;
          gradient.setAttribute('x1', '0');
          gradient.setAttribute('y1', '0');
          gradient.setAttribute('x2', '0');
          gradient.setAttribute('y2', '1');
          for (const [offset, stopColor] of [['0', '#000000'], ['0.72', color]]) {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', offset);
            stop.style.stopColor = stopColor;
            stop.style.stopOpacity = '1';
            gradient.appendChild(stop);
          }
          defs.appendChild(gradient);
          return gradient;
        }

        function applyAppearance() {
          for (const fillable of charManifest.fillables) {
            const color = state.appearance.fills[fillable.key] || fillable.defaultFill;
            const ids = fillable.targetIds || [fillable.id];
            for (const id of ids) {
              const el = svg.getElementById(id);
              if (!el) continue;
              el.style.fill = color;
              if (fillable.key === 'hair_fill' && hasStroke(el)) {
                el.style.stroke = darken(color);
                el.style.strokeOpacity = '1';
              }
            }
          }

          for (const group of charManifest.globalFillGroups) {
            const color = state.appearance.fills[group.key] || group.defaultFill;
            for (const id of group.targetIds) {
              const el = svg.getElementById(id);
              if (el) el.style.fill = color;
            }
          }

          for (const group of charManifest.toggleGroups) {
            const active = state.appearance.toggles[group.key] || group.defaultOption;
            if (group.key === 'blush') {
              setVisible(group.elementId, active === 'on');
              continue;
            }
            for (const option of group.options) setVisible(option.id, option.id === active);
            if (group.key === 'layer18') {
              const color = { g104: '#c8c9cd', g105: '#986334', g107: '#4599ba' }[active];
              const activeGroup = svg.getElementById(active);
              activeGroup?.querySelectorAll('path').forEach((path, index) => {
                const gradientId = `pose-lab-eye-${active}-${index}`;
                ensureEyeGradient(gradientId, color);
                path.style.fill = `url(#${gradientId})`;
                path.style.opacity = '1';
              });
            }
          }
        }

        function applyPose() {
          const pose = poses[state.pose];
          const armL = svg.getElementById(charManifest.arms.armL.jointId);
          const armR = svg.getElementById(charManifest.arms.armR.jointId);
          if (!armL || !armR) return;

          const pivotL = shoulderPivot(armL);
          const pivotR = shoulderPivot(armR);
          rotateWithBase(armL, pose.armL, pivotL);
          rotateWithBase(armR, pose.armR, pivotR);
          for (const id of charManifest.arms.armL.sleeveIds) {
            const el = svg.getElementById(id);
            if (el) rotateWithBase(el, pose.armL, pivotL);
          }
          for (const id of charManifest.arms.armR.sleeveIds) {
            const el = svg.getElementById(id);
            if (el) rotateWithBase(el, pose.armR, pivotR);
          }

          document.getElementById('armL').value = pose.armL;
          document.getElementById('armR').value = pose.armR;
          document.getElementById('armLValue').textContent = pose.armL + ' deg';
          document.getElementById('armRValue').textContent = pose.armR + ' deg';
          document.getElementById('snippet').value =
            `${state.pose}: { armL: ${pose.armL}, armR: ${pose.armR} },`;
        }

        function renderControls() {
          const poseSelect = document.getElementById('pose');
          poseSelect.innerHTML = Object.keys(poses).map((name) => `<option value="${name}">${name}</option>`).join('');
          poseSelect.value = state.pose;
          poseSelect.addEventListener('change', () => {
            state.pose = poseSelect.value;
            applyPose();
          });

          for (const id of ['armL', 'armR']) {
            document.getElementById(id).addEventListener('input', (event) => {
              poses[state.pose][id] = Number(event.target.value);
              applyPose();
            });
          }

          const fills = document.getElementById('fills');
          const fillRows = [
            ...charManifest.fillables.map((item) => ({ key: item.key, label: item.label, color: item.defaultFill })),
            ...charManifest.globalFillGroups.map((item) => ({ key: item.key, label: item.label, color: item.defaultFill })),
          ];
          fills.innerHTML = fillRows.map((item) => `
            <label>${item.label}
              <input type="color" data-fill="${item.key}" value="${state.appearance.fills[item.key] || item.color}" />
            </label>
          `).join('');
          fills.querySelectorAll('[data-fill]').forEach((input) => {
            input.addEventListener('input', () => {
              state.appearance.fills[input.dataset.fill] = input.value;
              applyAppearance();
            });
          });

          const toggles = document.getElementById('toggles');
          toggles.innerHTML = charManifest.toggleGroups.map((group) => `
            <label>${group.label}
              <select data-toggle="${group.key}">
                ${group.options.map((option) => `<option value="${option.id}">${option.label}</option>`).join('')}
              </select>
            </label>
          `).join('');
          toggles.querySelectorAll('[data-toggle]').forEach((select) => {
            select.value = state.appearance.toggles[select.dataset.toggle] || '';
            select.addEventListener('change', () => {
              state.appearance.toggles[select.dataset.toggle] = select.value;
              applyAppearance();
            });
          });

          document.getElementById('copy').addEventListener('click', async () => {
            await navigator.clipboard.writeText(document.getElementById('snippet').value);
            document.getElementById('status').textContent = 'Copied snippet.';
          });
          document.getElementById('saveSource').disabled = !serverMode;
          document.getElementById('saveSource').addEventListener('click', async () => {
            if (!serverMode) {
              document.getElementById('status').textContent = 'Source saving only works in app mode.';
              return;
            }
            const pose = poses[state.pose];
            const body = new URLSearchParams({
              pose: state.pose,
              armL: String(pose.armL),
              armR: String(pose.armR),
            });
            const res = await fetch('/api/pose', { method: 'POST', body });
            const data = await res.json();
            document.getElementById('status').textContent = data.message;
          });
          document.getElementById('save').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(poses, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'mentell-character-poses.json';
            a.click();
            URL.revokeObjectURL(a.href);
          });
        }

        renderControls();
        applyAppearance();
        applyPose();
      </script>
    </body>
    </html>
    """
  end

  defp poses_to_json(poses) do
    entries =
      poses
      |> Enum.map(fn {name, left, right} ->
        ~s("#{name}":{"armL":#{format_number(left)},"armR":#{format_number(right)}})
      end)

    "{" <> Enum.join(entries, ",") <> "}"
  end

  defp parse_number!(value, label) do
    case Float.parse(value) do
      {number, ""} -> number
      _ -> abort("Invalid #{label} number: #{value}")
    end
  end

  defp format_number(number) when is_float(number) do
    if number == Float.round(number) do
      Integer.to_string(round(number))
    else
      :erlang.float_to_binary(number, decimals: 2)
      |> String.trim_trailing("0")
      |> String.trim_trailing(".")
    end
  end

  defp abort(message) do
    IO.puts(:stderr, message)
    System.halt(1)
  end
end

MentellPoseLab.main(System.argv())
