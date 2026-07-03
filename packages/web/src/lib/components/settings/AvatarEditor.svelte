<script lang="ts">
	let { customBrandIcon, onsave, onreset }: {
		customBrandIcon: boolean;
		onsave: () => void;
		onreset: () => void;
	} = $props();

	let showModal = $state(false);
	let uploading = $state(false);
	let error = $state('');
	let previewUrl = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let imageEl = $state<HTMLImageElement>();
	let containerEl = $state<HTMLDivElement>();

	let imgLoaded = $state(false);
	let imgNaturalW = $state(0);
	let imgNaturalH = $state(0);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let displayScale = $state(1);
	let dragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let dragStartOffX = $state(0);
	let dragStartOffY = $state(0);

	const CROP_SIZE = 250;

	function openModal() {
		showModal = true;
		error = '';
		imgLoaded = false;
		previewUrl = null;
	}

	function closeModal() {
		showModal = false;
		imgLoaded = false;
		previewUrl = null;
		uploading = false;
		error = '';
	}

	function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const url = URL.createObjectURL(file);
		previewUrl = url;
		imgLoaded = false;
		error = '';

		const img = new Image();
		img.onload = () => {
			imgNaturalW = img.naturalWidth;
			imgNaturalH = img.naturalHeight;
			displayScale = Math.max(CROP_SIZE / imgNaturalW, CROP_SIZE / imgNaturalH);
			offsetX = (CROP_SIZE - imgNaturalW * displayScale) / 2;
			offsetY = (CROP_SIZE - imgNaturalH * displayScale) / 2;
			imgLoaded = true;
			requestAnimationFrame(drawPreview);
		};
		img.src = url;
	}

	function drawPreview() {
		const canvas = canvasEl;
		const img = imageEl;
		if (!canvas || !img || !imgLoaded) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const w = imgNaturalW * displayScale;
		const h = imgNaturalH * displayScale;

		canvas.width = CROP_SIZE;
		canvas.height = CROP_SIZE;
		ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
		ctx.save();
		ctx.beginPath();
		ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(img, offsetX, offsetY, w, h);
		ctx.restore();
	}

	$effect(() => {
		void offsetX;
		void offsetY;
		if (imgLoaded) requestAnimationFrame(drawPreview);
	});

	function handlePointerDown(e: PointerEvent) {
		if (!imgLoaded) return;
		dragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartOffX = offsetX;
		dragStartOffY = offsetY;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		const w = imgNaturalW * displayScale;
		const h = imgNaturalH * displayScale;
		const newX = dragStartOffX + dx;
		const newY = dragStartOffY + dy;
		offsetX = Math.min(0, Math.max(CROP_SIZE - w, newX));
		offsetY = Math.min(0, Math.max(CROP_SIZE - h, newY));
	}

	function handlePointerUp() {
		dragging = false;
	}

	function getCroppedBlob(): Promise<Blob> {
		return new Promise((resolve) => {
			const canvas = document.createElement('canvas');
			const size = Math.min(imgNaturalW, imgNaturalH);
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d')!;
			const scale = size / imgNaturalW;
			ctx.drawImage(imageEl!, offsetX / displayScale, offsetY / displayScale, size / scale, size / scale, 0, 0, size, size);
			canvas.toBlob((b) => resolve(b!), 'image/png');
		});
	}

	async function handleUpload() {
		if (!imgLoaded) return;
		uploading = true;
		error = '';

		try {
			const blob = await getCroppedBlob();
			const formData = new FormData();
			formData.append('file', blob, 'icon.png');

			const res = await fetch('/api/brand-icon', { method: 'POST', body: formData });
			if (res.ok) {
				closeModal();
				onsave();
			} else {
				const data = await res.json();
				error = data.error || '上传失败';
			}
		} catch {
			error = '上传失败';
		}
		uploading = false;
	}

	async function handleReset() {
		try {
			await fetch('/api/brand-icon', { method: 'DELETE' });
			onreset();
		} catch { /* ignore */ }
	}
</script>

<div class="brand-icon-row">
	<div class="brand-icon-preview">
		{#if customBrandIcon}
			<img src="/api/brand-icon?t={Date.now()}" alt="头像" class="preview-img" />
		{:else}
			<span class="material-symbols-rounded preview-icon">spa</span>
		{/if}
	</div>
	<div class="brand-icon-actions">
		<button class="btn btn-sm" onclick={openModal}>上传图片</button>
		{#if customBrandIcon}
			<button class="btn btn-sm btn-danger" onclick={handleReset}>恢复默认</button>
		{/if}
	</div>
</div>

{#if showModal}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="modal-overlay" onclick={closeModal} onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeModal()} role="dialog" tabindex="-1">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal" onclick={(e: Event) => e.stopPropagation()} onkeydown={(e: Event) => e.stopPropagation()} role="document" tabindex="-1">
			<h3>上传头像</h3>

			{#if !imgLoaded}
				<div class="upload-area">
					<label class="upload-label">
						<span class="material-symbols-rounded upload-icon">image</span>
						<span>选择图片</span>
						<input type="file" accept="image/*" onchange={handleFile} class="file-input" />
					</label>
				</div>
			{:else}
				<p class="crop-hint">拖拽图片调整位置</p>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={containerEl}
					class="crop-container"
					onpointerdown={handlePointerDown}
					onpointermove={handlePointerMove}
					onpointerup={handlePointerUp}
				>
					{#if previewUrl}
						<img bind:this={imageEl} src={previewUrl} alt="" class="crop-image" />
					{/if}
					<canvas bind:this={canvasEl} class="crop-canvas"></canvas>
					<div class="crop-mask"></div>
				</div>
			{/if}

			{#if error}
				<div class="msg msg-error">{error}</div>
			{/if}

			<div class="form-actions">
				<button type="button" class="btn" onclick={closeModal}>取消</button>
				<button
					type="button"
					class="btn btn-primary"
					onclick={handleUpload}
					disabled={!imgLoaded || uploading}
				>
					{uploading ? '上传中...' : '确认上传'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.brand-icon-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 1.25rem 1.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
		box-shadow: var(--shadow-xs);
	}

	.brand-icon-preview {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-full);
		background: var(--bg-done);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}

	.preview-icon {
		font-size: 28px;
		color: var(--accent);
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.brand-icon-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.5rem 1.25rem;
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-pill);
		background: var(--bg-surface);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		font-family: inherit;
		transition: transform 0.15s var(--ease-out), background-color 0.2s var(--ease-out);
	}

	.btn:hover { background: var(--bg-surface-hover); }
	.btn:active { transform: scale(0.97); }
	.btn-sm { padding: 0.4rem 1rem; font-size: var(--text-sm); }
	.btn-primary {
		background: var(--accent);
		color: var(--text-on-accent);
		border-color: var(--accent);
		box-shadow: var(--shadow-accent-btn);
	}
	.btn-primary:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}
	.btn-primary:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.btn-danger {
		color: var(--danger-btn);
		border-color: rgba(211, 47, 47, 0.2);
		background: var(--bg-surface);
	}
	.btn-danger:hover {
		background: var(--danger-btn-hover-bg);
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-heavy);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: var(--bg-surface);
		border-radius: var(--radius-3xl);
		padding: 2.5rem;
		width: 100%;
		max-width: 420px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: var(--shadow-modal);
		animation: modalScale 0.25s var(--ease-out) forwards;
	}

	@keyframes modalScale {
		from { opacity: 0; transform: scale(0.94) translateY(12px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.modal h3 {
		margin: 0 0 1.75rem;
		font-size: var(--text-2xl);
		font-weight: 500;
		color: var(--text-primary);
	}

	.upload-area {
		display: flex;
		justify-content: center;
		padding: 3rem 0;
	}

	.upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2.5rem 3rem;
		border: 2px dashed var(--border-hover);
		border-radius: var(--radius-xl);
		cursor: pointer;
		color: var(--text-secondary);
		font-size: var(--text-base);
		transition: border-color 0.25s var(--ease-out), background 0.25s var(--ease-out);
	}

	.upload-label:hover {
		border-color: var(--accent);
		background: var(--bg-surface-alt);
	}

	.upload-icon {
		font-size: 36px;
		color: var(--text-muted);
	}

	.file-input {
		display: none;
	}

	.crop-hint {
		text-align: center;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		margin: 0 0 0.75rem;
	}

	.crop-container { position: relative; width: 250px; height: 250px; margin: 0 auto; cursor: grab; overflow: hidden; }
	.crop-container:active { cursor: grabbing; }
	.crop-image { display: none; }
	.crop-canvas { width: 100%; height: 100%; }
	.crop-mask {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-full);
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
		pointer-events: none;
	}

	.msg-error {
		color: var(--danger-text);
		background: var(--danger-bg);
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		margin-top: 1rem;
		font-size: 0.9rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 1.75rem;
	}

	.upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2.5rem 3rem;
		border: 2px dashed var(--border-hover);
		border-radius: 20px;
		cursor: pointer;
		color: var(--text-secondary);
		font-size: 0.95rem;
		transition: border-color 0.2s, background 0.2s;
	}

	.upload-label:hover {
		border-color: var(--accent);
		background: var(--bg-surface-alt);
	}

	.upload-icon {
		font-size: 36px;
		color: var(--text-muted);
	}

	.file-input {
		display: none;
	}

	.crop-hint {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.85rem;
		margin: 0 0 0.75rem;
	}

	.crop-container {
		position: relative;
		width: 250px;
		height: 250px;
		margin: 0 auto;
		cursor: grab;
		overflow: hidden;
	}

	.crop-container:active {
		cursor: grabbing;
	}

	.crop-image {
		display: none;
	}

	.crop-canvas {
		width: 100%;
		height: 100%;
	}

	.crop-mask {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
		pointer-events: none;
	}

	.msg-error {
		color: var(--danger-text);
		background: var(--danger-bg);
		padding: 0.75rem 1rem;
		border-radius: 12px;
		margin-top: 1rem;
		font-size: 0.9rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 1.75rem;
	}
</style>
