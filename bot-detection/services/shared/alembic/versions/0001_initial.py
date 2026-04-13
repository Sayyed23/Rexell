"""Initial migration

Revision ID: 0001
Revises: 
Create Date: 2026-04-06 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table('behavioral_data',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('user_hash', sa.String(), nullable=False),
        sa.Column('user_agent', sa.String(), nullable=False),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('events', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
        sa.Column('expires_at', sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_behavioral_data_expires_at'), 'behavioral_data', ['expires_at'], unique=False)
    op.create_index(op.f('ix_behavioral_data_session_id'), 'behavioral_data', ['session_id'], unique=False)
    op.create_index(op.f('ix_behavioral_data_user_hash'), 'behavioral_data', ['user_hash'], unique=False)

    op.create_table('audit_log',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('timestamp', sa.BigInteger(), nullable=False),
        sa.Column('accessor_identity', sa.String(), nullable=False),
        sa.Column('operation_type', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_log_timestamp'), 'audit_log', ['timestamp'], unique=False)

    op.create_table('challenge_state',
        sa.Column('challenge_id', sa.String(), nullable=False),
        sa.Column('user_hash', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('challenge_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
        sa.Column('expires_at', sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint('challenge_id')
    )
    op.create_index(op.f('ix_challenge_state_expires_at'), 'challenge_state', ['expires_at'], unique=False)
    op.create_index(op.f('ix_challenge_state_session_id'), 'challenge_state', ['session_id'], unique=False)
    op.create_index(op.f('ix_challenge_state_user_hash'), 'challenge_state', ['user_hash'], unique=False)

    op.create_table('user_reputation',
        sa.Column('user_hash', sa.String(), nullable=False),
        sa.Column('reputation_score', sa.Float(), nullable=False),
        sa.Column('trusted_status', sa.Boolean(), nullable=False),
        sa.Column('flagged', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
        sa.Column('updated_at', sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint('user_hash')
    )

    op.create_table('verification_tokens',
        sa.Column('token_id', sa.String(), nullable=False),
        sa.Column('user_hash', sa.String(), nullable=False),
        sa.Column('event_id', sa.String(), nullable=True),
        sa.Column('max_quantity', sa.Integer(), nullable=True),
        sa.Column('issued_at', sa.BigInteger(), nullable=False),
        sa.Column('expires_at', sa.BigInteger(), nullable=False),
        sa.Column('consumed_at', sa.BigInteger(), nullable=True),
        sa.Column('tx_hash', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('token_id')
    )
    op.create_index(op.f('ix_verification_tokens_expires_at'), 'verification_tokens', ['expires_at'], unique=False)
    op.create_index(op.f('ix_verification_tokens_user_hash'), 'verification_tokens', ['user_hash'], unique=False)

    op.create_table('risk_scores',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('behavioral_data_id', sa.String(), nullable=True),
        sa.Column('user_hash', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('decision', sa.String(), nullable=False),
        sa.Column('factors', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(['behavioral_data_id'], ['behavioral_data.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_risk_scores_session_id'), 'risk_scores', ['session_id'], unique=False)
    op.create_index(op.f('ix_risk_scores_user_hash'), 'risk_scores', ['user_hash'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_risk_scores_user_hash'), table_name='risk_scores')
    op.drop_index(op.f('ix_risk_scores_session_id'), table_name='risk_scores')
    op.drop_table('risk_scores')
    op.drop_index(op.f('ix_verification_tokens_user_hash'), table_name='verification_tokens')
    op.drop_index(op.f('ix_verification_tokens_expires_at'), table_name='verification_tokens')
    op.drop_table('verification_tokens')
    op.drop_table('user_reputation')
    op.drop_index(op.f('ix_challenge_state_user_hash'), table_name='challenge_state')
    op.drop_index(op.f('ix_challenge_state_session_id'), table_name='challenge_state')
    op.drop_index(op.f('ix_challenge_state_expires_at'), table_name='challenge_state')
    op.drop_table('challenge_state')
    op.drop_index(op.f('ix_audit_log_timestamp'), table_name='audit_log')
    op.drop_table('audit_log')
    op.drop_index(op.f('ix_behavioral_data_user_hash'), table_name='behavioral_data')
    op.drop_index(op.f('ix_behavioral_data_session_id'), table_name='behavioral_data')
    op.drop_index(op.f('ix_behavioral_data_expires_at'), table_name='behavioral_data')
    op.drop_table('behavioral_data')
