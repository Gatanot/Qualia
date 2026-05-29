<div class="empty-state">
	<div class="empty-icon-container">
		<span class="material-symbols-rounded empty-icon">spa</span>
	</div>
	<h2>Qualia</h2>
	<p>你的虚拟伙伴，随时倾听</p>
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: #706862;
		gap: 0.75rem;
		animation: fadeIn 0.8s ease-out forwards;
		opacity: 0;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.empty-icon-container {
		width: 96px;
		height: 96px;
		background: #F0EBE1;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.5rem;
		box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 12px rgba(61, 56, 52, 0.05);
	}

	.empty-icon {
		font-size: 48px;
		color: #5E7163;
	}

	.empty-state h2 {
		margin: 0;
		font-weight: 400;
		font-size: 2rem;
		color: #3D3834;
		letter-spacing: 0.5px;
	}

	.empty-state p {
		margin: 0;
		font-size: 1.1rem;
		color: #706862;
	}
</style>
