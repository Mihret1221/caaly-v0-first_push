import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity("active_tokens")
@Index(["user_id", "user_type"])
@Index(["jti"], { unique: true })
@Index(["expires_at"])
export class ActiveToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  user_id!: number;

  @Column({ type: "enum", enum: ["user", "admin"] })
  user_type!: "user" | "admin";

  @Column({ type: "varchar", length: 255, unique: true })
  jti!: string;

  @Column({ type: "timestamp" })
  issued_at!: Date;

  @Column({ type: "timestamp" })
  expires_at!: Date;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}
