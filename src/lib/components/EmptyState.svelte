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
		color: #8E857D;
		gap: 0.75rem;
		animation: fadeIn 1s cubic-bezier(0.2, 0, 0, 1) forwards;
		opacity: 0;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(15px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.empty-icon-container {
		width: 110px;
		height: 110px;
		background: #F2EEE5;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
		box-shadow: inset 0 4px 8px rgba(255, 255, 255, 0.6), 0 8px 24px rgba(74, 69, 66, 0.06);
	}

	.empty-icon {
		font-size: 52px;
		color: #7B8C7C;
	}

	.empty-state h2 {
		margin: 0;
		font-weight: 300;
		font-size: 2.25rem;
		color: #4A4542;
		letter-spacing: 0.04em;
	}

	.empty-state p {
		margin: 0;
		font-size: 1.15rem;
		color: #8E857D;
		font-weight: 400;
	}
</style>
