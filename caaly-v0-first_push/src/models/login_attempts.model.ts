import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./users.model.js";

@Entity("login_attempts")
export class LoginAttempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  user_id!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "int", default: 0 })
  failed_attempts!: number;

  @Column({ type: "timestamp", nullable: true })
  locked_until!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  last_attempt_at!: Date | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;
}
