import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import archivosConfig from './config/archivos.config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { ServidoresModule } from './servidores/servidores.module';
import { CargasModule } from './cargas/cargas.module';
import { LibrosModule } from './libros/libros.module';
import { ReportesModule } from './reportes/reportes.module';
import { DocumentosModule } from './documentos/documentos.module';

interface MysqlConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, archivosConfig],
    }),
    // Conexión principal (default): base cddiputados. Los cambios de esquema van
    // siempre por migraciones; synchronize nunca se activa.
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): SequelizeModuleOptions => {
        const db = config.get<MysqlConnectionConfig>('database.main')!;
        return {
          dialect: 'mysql',
          ...db,
          models: [],
          autoLoadModels: true,
          synchronize: false,
        };
      },
    }),
    // Conexión declaranet: base declaranet.
    SequelizeModule.forRootAsync({
      name: 'declaranet',
      inject: [ConfigService],
      useFactory: (config: ConfigService): SequelizeModuleOptions => {
        const db = config.get<MysqlConnectionConfig>('database.declaranet')!;
        return {
          dialect: 'mysql',
          ...db,
          models: [],
          autoLoadModels: true,
          synchronize: false,
        };
      },
    }),
    DocumentosModule,
    HealthModule,
    AuthModule,
    RolesModule,
    UsuariosModule,
    CatalogosModule,
    ServidoresModule,
    CargasModule,
    LibrosModule,
    ReportesModule,
  ],
})
export class AppModule {}
