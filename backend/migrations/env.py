from logging.config import fileConfig
from alembic import context
from sqlalchemy import create_engine, pool

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)


def run():
    supplied_connection = config.attributes.get("connection")
    if supplied_connection is not None:
        # Operator bootstrap already authenticated a restricted migration role. Reuse that
        # connection without reading app secrets or constructing an unrelated local engine.
        context.configure(connection=supplied_connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()
        return

    from app.config import settings
    from app.db import Base
    from app import models  # noqa: F401

    url = settings().database_url
    if context.is_offline_mode():
        context.configure(
            url=url, target_metadata=Base.metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}
        )
        with context.begin_transaction():
            context.run_migrations()
    else:
        engine = create_engine(url, poolclass=pool.NullPool)
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
        engine.dispose()


run()
