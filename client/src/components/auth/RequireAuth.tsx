import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMeQuery } from "@/features/auth/queries";

type RequireAuthProps = {
	children: ReactNode;
};

export default function RequireAuth({ children }: RequireAuthProps) {
	const { data, isLoading, isError } = useMeQuery();
	const location = useLocation();
	if (isLoading) return null;
	if (isError || !data) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}
	return <>{children}</>;
}


